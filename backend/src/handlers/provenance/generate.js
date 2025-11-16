/**
 * Generate provenance report handler
 */

const { v4: uuidv4 } = require('uuid');
const { getItem, putItem, queryItems, queryByIndex } = require('../../lib/dynamodb');
const { getUserIdFromEvent } = require('../../lib/cognito');
const { validateCSRF } = require('../../lib/csrf');
const { invokeNova } = require('../../lib/bedrock');
const response = require('../../lib/response');
const { handleError } = require('../../lib/errors');
const { TABLES } = require('../../config/constants');

async function generateReport(event) {
  try {
    validateCSRF(event);
    const userId = await getUserIdFromEvent(event);
    const { guitarId } = event.pathParameters;

    // Parse request body to get report type
    const body = event.body ? JSON.parse(event.body) : {};
    const reportType = body.type || 'provenance'; // 'provenance' or 'sales_ad'

    console.log(`Generating ${reportType} report for guitar:`, guitarId);

    // Get guitar data
    const guitar = await getItem(TABLES.GUITARS, { userId, guitarId });
    if (!guitar) {
      return response.notFound('Guitar not found');
    }

    // Get linked documents if any
    let linkedDocuments = [];
    if (guitar.documentIds && guitar.documentIds.length > 0) {
      const allDocuments = await queryItems(
        TABLES.DOCUMENTS,
        'userId = :userId',
        { ':userId': userId }
      );
      linkedDocuments = allDocuments.filter(doc =>
        guitar.documentIds.includes(doc.documentId)
      );
    }

    // Get existing reports of this type to determine next version
    const existingReports = await queryByIndex(
      TABLES.PROVENANCE_REPORTS,
      'GuitarIdIndex',
      'guitarId = :guitarId',
      { ':guitarId': guitarId }
    );
    const existingOfType = existingReports.filter(r => r.reportType === reportType);
    const nextVersion = existingOfType.length + 1;

    // Get user name from event
    const userName = event.requestContext.authorizer?.jwt?.claims?.name || 'Owner';

    // Generate AI-enhanced content using Nova based on type
    const enhancedContent = reportType === 'sales_ad'
      ? await generateSalesAdContent(guitar, linkedDocuments)
      : await generateEnhancedContent(guitar, linkedDocuments, userName);

    // Create report
    const reportId = `${guitarId}#${reportType}#v${nextVersion}`;
    const report = {
      userId,
      reportId,
      guitarId,
      reportType,
      version: nextVersion,
      generatedAt: new Date().toISOString(),
      ownerName: userName,
      reportData: enhancedContent,
    };

    await putItem(TABLES.PROVENANCE_REPORTS, report);

    const typeName = reportType === 'sales_ad' ? 'sales ad' : 'provenance report';
    return response.created({
      message: `${typeName.charAt(0).toUpperCase() + typeName.slice(1)} generated successfully`,
      report: {
        id: reportId,
        version: nextVersion,
        generatedAt: report.generatedAt,
        guitarId,
        type: reportType,
      },
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return handleError(error, response);
  }
}

async function generateEnhancedContent(guitar, documents, ownerName) {
  // Build comprehensive context for Nova
  const context = buildContext(guitar, documents);

  //Generate all sections concurrently for speed
  const [overview, specifications, provenance, authentication] = await Promise.all([
    generateOverview(context, ownerName),
    generateSpecifications(context),
    generateProvenance(context, ownerName),
    generateAuthentication(context, documents),
  ]);

  return {
    overview,
    specifications,
    provenance,
    authentication,
    valuation: generateValuation(guitar),
    metadata: {
      guitarBrand: guitar.brand,
      guitarModel: guitar.model,
      guitarYear: guitar.year,
      serialNumber: guitar.serialNumber || null,
    },
  };
}

function buildContext(guitar, documents) {
  return {
    basic: {
      brand: guitar.brand,
      model: guitar.model,
      year: guitar.year,
      serialNumber: guitar.serialNumber,
      type: guitar.type,
      color: guitar.color,
      finish: guitar.finish,
      condition: guitar.condition,
    },
    specs: guitar.detailedSpecs || {},
    notes: guitar.notes || [],
    privateInfo: guitar.privateInfo || {},
    documents: documents.map(d => ({
      name: d.name,
      type: d.type,
      notes: d.notes,
    })),
  };
}

async function generateOverview(context, ownerName) {
  const prompt = `You are creating a professional instrument provenance certificate section.

Generate a formal, authoritative overview paragraph for this guitar:
- Brand: ${context.basic.brand}
- Model: ${context.basic.model}
- Year: ${context.basic.year}
- Type: ${context.basic.type}
- Serial Number: ${context.basic.serialNumber || 'Not specified'}

Context from owner notes: ${JSON.stringify(context.notes)}

Write a single paragraph (3-5 sentences) that:
1. Introduces the instrument formally
2. Highlights key distinguishing features
3. Maintains professional, certificate-appropriate tone
4. Is grammatically perfect and well-structured

Return ONLY the paragraph text, no additional formatting or labels.`;

  return await invokeNova(prompt, { temperature: 0.5 });
}

async function generateSpecifications(context) {
  const prompt = `You are creating technical specifications for an instrument provenance certificate.

Given these specifications:
${JSON.stringify(context.specs, null, 2)}

Basic info:
${JSON.stringify(context.basic, null, 2)}

Generate a clean, professional specifications section that:
1. Groups specifications logically (Construction, Electronics, Hardware, etc.)
2. Uses proper technical terminology
3. Formats consistently
4. Is complete and accurate

Return ONLY valid JSON (no markdown, no explanations) with this structure:
{
  "construction": { "key": "value" pairs },
  "electronics": { "key": "value" pairs },
  "hardware": { "key": "value" pairs },
  "finish": { "key": "value" pairs }
}`;

  const result = await invokeNova(prompt, { temperature: 0.3 });
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = result.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : result;
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse specifications JSON:', error);
    return { raw: result };
  }
}

async function generateProvenance(context, ownerName) {
  const notesText = context.notes.map(n => `${n.date || 'Undated'}: ${n.content}`).join('\n');
  const purchaseInfo = context.privateInfo.purchaseDate || context.privateInfo.purchaseLocation
    ? `Acquired ${context.privateInfo.purchaseDate || ''} ${context.privateInfo.purchaseLocation ? 'from ' + context.privateInfo.purchaseLocation : ''}`
    : '';

  const prompt = `You are writing the provenance section for an instrument authentication certificate.

Owner: ${ownerName}

Historical notes and timeline:
${notesText}

Purchase information:
${purchaseInfo}

Generate a professional provenance narrative that:
1. Establishes chain of custody
2. Creates a coherent timeline
3. Maintains formal certificate tone
4. Presents information factually
5. Is 2-4 paragraphs

Return ONLY the narrative text, properly formatted with paragraph breaks.`;

  return await invokeNova(prompt, { temperature: 0.6 });
}

async function generateAuthentication(context, documents) {
  const hasSerial = !!context.basic.serialNumber;
  const hasReceipt = context.privateInfo.receiptUrl;
  const docCount = documents.length;

  return {
    serialNumber: context.basic.serialNumber || null,
    hasPhotographicDocumentation: true,
    hasReceiptDocumentation: hasReceipt,
    supportingDocuments: docCount,
    documentTypes: documents.map(d => ({ name: d.name, type: d.type })),
    authenticationLevel: hasSerial && hasReceipt ? 'High' : hasSerial ? 'Medium' : 'Basic',
  };
}

function generateValuation(guitar) {
  const purchasePrice = guitar.privateInfo?.purchasePrice;
  const currentValue = guitar.privateInfo?.estimatedValue;

  return {
    purchasePrice: purchasePrice || null,
    purchaseDate: guitar.privateInfo?.purchaseDate || null,
    currentEstimatedValue: currentValue || null,
    condition: guitar.condition,
    notes: currentValue && purchasePrice && currentValue > purchasePrice
      ? 'Instrument has appreciated in value'
      : null,
  };
}

async function generateSalesAdContent(guitar, documents) {
  const context = buildContext(guitar, documents);

  // Generate all sales ad sections concurrently
  const [headline, description, features, specs] = await Promise.all([
    generateSalesHeadline(context),
    generateSalesDescription(context),
    generateSalesFeatures(context),
    generateSalesSpecs(context),
  ]);

  return {
    headline,
    description,
    features,
    specifications: specs,
    condition: guitar.condition || 'Excellent',
    price: guitar.privateInfo?.purchasePrice || guitar.privateInfo?.estimatedValue || null,
    images: guitar.images || [],
    metadata: {
      guitarBrand: guitar.brand,
      guitarModel: guitar.model,
      guitarYear: guitar.year,
      serialNumber: guitar.serialNumber || null,
    },
  };
}

async function generateSalesHeadline(context) {
  const prompt = `You are writing a compelling sales headline for a guitar listing on marketplaces like Reverb or eBay.

Guitar details:
- Brand: ${context.basic.brand}
- Model: ${context.basic.model}
- Year: ${context.basic.year}
- Condition: ${context.basic.condition}
- Color/Finish: ${context.basic.color} ${context.basic.finish}

Create a short, attention-grabbing headline (8-12 words) that:
1. Includes year, brand, and model
2. Highlights the condition or a key feature
3. Is compelling but honest
4. Follows marketplace best practices

Return ONLY the headline text, no quotes or extra formatting.`;

  return await invokeNova(prompt, { temperature: 0.7 });
}

async function generateSalesDescription(context) {
  const notesText = context.notes.map(n => n.content).join(' ');

  const prompt = `You are writing a compelling sales description for a guitar listing.

Guitar details:
- Brand: ${context.basic.brand}
- Model: ${context.basic.model}
- Year: ${context.basic.year}
- Type: ${context.basic.type}
- Condition: ${context.basic.condition}
- Serial: ${context.basic.serialNumber || 'Not specified'}

Owner notes: ${notesText || 'None provided'}

Specifications: ${JSON.stringify(context.specs)}

Write an engaging sales description (3-5 paragraphs) that:
1. Opens with why this guitar is special
2. Describes the tone, playability, and feel
3. Mentions notable features and specifications
4. Addresses condition honestly
5. Creates emotional connection while staying factual
6. Uses marketplace-friendly language
7. Ends with a call to action

Return ONLY the description text with paragraph breaks.`;

  return await invokeNova(prompt, { temperature: 0.7 });
}

async function generateSalesFeatures(context) {
  const prompt = `You are creating a bullet-point feature list for a guitar sales listing.

Guitar specifications:
${JSON.stringify(context.specs, null, 2)}

Basic details:
${JSON.stringify(context.basic, null, 2)}

Create a concise list of 5-8 key selling points that:
1. Highlights premium features
2. Includes technical specs that matter
3. Mentions unique characteristics
4. Is easy to scan
5. Uses marketplace-friendly language

Return ONLY a JSON array of strings, no markdown or explanations:
["Feature 1", "Feature 2", ...]`;

  const result = await invokeNova(prompt, { temperature: 0.5 });
  try {
    const jsonMatch = result.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : result;
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse features JSON:', error);
    // Return a basic array if parsing fails
    return result.split('\n').filter(line => line.trim()).map(line => line.replace(/^[-*]\s*/, '').trim());
  }
}

async function generateSalesSpecs(context) {
  const prompt = `You are creating a clean specifications table for a guitar sales listing.

Given specifications:
${JSON.stringify(context.specs, null, 2)}

Basic info:
${JSON.stringify(context.basic, null, 2)}

Create a clean, easy-to-read specs section with key details buyers care about.

Return ONLY valid JSON (no markdown, no explanations) with this structure:
{
  "body": { "key": "value" pairs for body specs },
  "neck": { "key": "value" pairs for neck specs },
  "electronics": { "key": "value" pairs for electronics },
  "hardware": { "key": "value" pairs for hardware },
  "other": { "key": "value" pairs for other important details }
}`;

  const result = await invokeNova(prompt, { temperature: 0.3 });
  try {
    const jsonMatch = result.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : result;
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse sales specs JSON:', error);
    return { raw: result };
  }
}

module.exports = { generateReport };
