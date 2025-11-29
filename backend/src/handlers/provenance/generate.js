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
      serialNumber: guitar.privateInfo?.serialNumber || null,
    },
  };
}

function buildContext(guitar, documents) {
  // Build condition summary from markers
  let conditionSummary = null;
  if (guitar.conditionMarkers && guitar.conditionMarkers.length > 0) {
    const markers = guitar.conditionMarkers;
    const bySeverity = {
      minor: markers.filter(m => m.severity === 'minor'),
      moderate: markers.filter(m => m.severity === 'moderate'),
      major: markers.filter(m => m.severity === 'major'),
    };
    conditionSummary = {
      totalIssues: markers.length,
      minorCount: bySeverity.minor.length,
      moderateCount: bySeverity.moderate.length,
      majorCount: bySeverity.major.length,
      issues: markers.map(m => ({
        severity: m.severity,
        type: m.type,
        note: m.note,
        location: m.view, // front or back
      })),
    };
  }

  // Extract content from linked documents
  const documentContent = documents
    .filter(d => d.extractedContent?.text || d.extractedContent?.description)
    .map(d => ({
      name: d.name,
      type: d.type,
      extractedText: d.extractedContent?.text?.substring(0, 2000), // Limit to 2000 chars
      description: d.extractedContent?.description,
    }));

  // Serial number is in privateInfo
  const serialNumber = guitar.privateInfo?.serialNumber || null;

  return {
    basic: {
      brand: guitar.brand,
      model: guitar.model,
      year: guitar.year,
      serialNumber,
      type: guitar.type,
      color: guitar.color,
      finish: guitar.finish,
      condition: guitar.condition,
      countryOfOrigin: guitar.countryOfOrigin,
      caseIncluded: guitar.caseIncluded,
    },
    coreSpecs: {
      bodyMaterial: guitar.bodyMaterial,
      neckMaterial: guitar.neckMaterial,
      fretboardMaterial: guitar.fretboardMaterial,
      numberOfFrets: guitar.numberOfFrets,
      scaleLength: guitar.scaleLength,
      pickupConfiguration: guitar.pickupConfiguration,
      tuningMachines: guitar.tuningMachines,
      bridge: guitar.bridge,
      nut: guitar.nut,
      electronics: guitar.electronics,
    },
    detailedSpecs: guitar.detailedSpecs || {},
    conditionReport: conditionSummary,
    notes: guitar.notes || [],
    privateInfo: {
      ...guitar.privateInfo,
      originalRetailPrice: guitar.privateInfo?.originalRetailPrice,
      currency: guitar.privateInfo?.currency || 'USD',
    },
    documents: documents.map(d => ({
      name: d.name,
      type: d.type,
      notes: d.notes,
    })),
    documentContent,
  };
}

async function generateOverview(context, ownerName) {
  // Include document-extracted content if available
  const docContext = context.documentContent?.length > 0
    ? `\n\nRelevant information from attached documents:\n${context.documentContent.map(d =>
        `${d.name}: ${d.extractedText || d.description || 'No content'}`
      ).join('\n')}`
    : '';

  const prompt = `You are creating a professional instrument provenance certificate section.

Generate a formal, authoritative overview paragraph for this guitar:
- Brand: ${context.basic.brand}
- Model: ${context.basic.model}
- Year: ${context.basic.year}
- Type: ${context.basic.type}
- Serial Number: ${context.basic.serialNumber || 'Not specified'}
- Country of Origin: ${context.basic.countryOfOrigin || 'Not specified'}
- Body: ${context.coreSpecs.bodyMaterial || 'Not specified'}
- Neck: ${context.coreSpecs.neckMaterial || 'Not specified'}
- Fretboard: ${context.coreSpecs.fretboardMaterial || 'Not specified'}
- Pickups: ${context.coreSpecs.pickupConfiguration || 'Not specified'}

Context from owner notes: ${JSON.stringify(context.notes)}
${docContext}

Write a single paragraph (3-5 sentences) that:
1. Introduces the instrument formally
2. Highlights key distinguishing features (materials, origin, pickups)
3. Maintains professional, certificate-appropriate tone
4. Is grammatically perfect and well-structured

Return ONLY the paragraph text, no additional formatting or labels.`;

  return await invokeNova(prompt, { temperature: 0.5 });
}

async function generateSpecifications(context) {
  const prompt = `You are creating technical specifications for an instrument provenance certificate.

Core specifications:
${JSON.stringify(context.coreSpecs, null, 2)}

Detailed specifications:
${JSON.stringify(context.detailedSpecs, null, 2)}

Basic info:
${JSON.stringify(context.basic, null, 2)}

Generate a clean, professional specifications section that:
1. Groups specifications logically (Construction, Electronics, Hardware, Finish)
2. Uses proper technical terminology
3. Formats consistently
4. Includes ALL provided specs - do not omit any data
5. Is complete and accurate

Return ONLY valid JSON (no markdown, no explanations) with this structure:
{
  "construction": { "key": "value" pairs for body, neck, fretboard, frets, scale length },
  "electronics": { "key": "value" pairs for pickups, controls, electronics },
  "hardware": { "key": "value" pairs for bridge, tuners, nut, hardware finish },
  "finish": { "key": "value" pairs for color, finish type, binding }
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
  const notesText = context.notes.map(n => `${n.createdAt || 'Undated'}: ${n.content}`).join('\n');
  const purchaseInfo = context.privateInfo.purchaseDate || context.privateInfo.purchaseLocation
    ? `Acquired ${context.privateInfo.purchaseDate || ''} ${context.privateInfo.purchaseLocation ? 'from ' + context.privateInfo.purchaseLocation : ''}`
    : '';

  // Include document-extracted content for historical context
  const docContext = context.documentContent?.length > 0
    ? `\n\nInformation from attached documents (receipts, catalogs, etc.):\n${context.documentContent.map(d =>
        `${d.name}: ${d.extractedText || d.description || 'No content'}`
      ).join('\n\n')}`
    : '';

  const prompt = `You are writing the provenance section for an instrument authentication certificate.

Guitar: ${context.basic.year} ${context.basic.brand} ${context.basic.model}
Serial Number: ${context.basic.serialNumber || 'Not documented'}
Country of Origin: ${context.basic.countryOfOrigin || 'Not specified'}
Owner: ${ownerName}

Historical notes and timeline:
${notesText || 'No notes provided'}

Purchase information:
${purchaseInfo || 'Not documented'}
${docContext}

Generate a professional provenance narrative that:
1. Establishes chain of custody based on available documentation
2. Creates a coherent timeline from manufacture to current ownership
3. References any supporting documents (receipts, catalogs) if provided
4. Maintains formal certificate tone
5. Presents information factually - do not invent details
6. Is 2-4 paragraphs

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
  const currentValue = guitar.privateInfo?.currentValue;
  const originalRetail = guitar.privateInfo?.originalRetailPrice;
  const currency = guitar.privateInfo?.currency || 'USD';

  // Generate valuation notes based on available data
  let notes = null;
  if (currentValue && purchasePrice && currentValue > purchasePrice) {
    const appreciation = ((currentValue - purchasePrice) / purchasePrice * 100).toFixed(0);
    notes = `Instrument has appreciated ${appreciation}% from purchase price`;
  } else if (originalRetail && purchasePrice && purchasePrice < originalRetail) {
    notes = `Acquired below original retail price`;
  }

  return {
    purchasePrice: purchasePrice || null,
    purchaseDate: guitar.privateInfo?.purchaseDate || null,
    originalRetailPrice: originalRetail || null,
    currentEstimatedValue: currentValue || null,
    currency,
    condition: guitar.condition,
    caseIncluded: guitar.caseIncluded || false,
    notes,
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

  // Build condition string with issue summary if available
  let conditionString = guitar.condition || 'Excellent';
  if (context.conditionReport) {
    const { minorCount, moderateCount, majorCount } = context.conditionReport;
    const issues = [];
    if (majorCount > 0) issues.push(`${majorCount} major`);
    if (moderateCount > 0) issues.push(`${moderateCount} moderate`);
    if (minorCount > 0) issues.push(`${minorCount} minor`);
    if (issues.length > 0) {
      conditionString += ` (${issues.join(', ')} issue${context.conditionReport.totalIssues > 1 ? 's' : ''} documented)`;
    }
  }

  return {
    headline,
    description,
    features,
    specifications: specs,
    condition: conditionString,
    conditionDetails: context.conditionReport,
    price: guitar.privateInfo?.currentValue || guitar.privateInfo?.purchasePrice || null,
    currency: guitar.privateInfo?.currency || 'USD',
    caseIncluded: guitar.caseIncluded || false,
    images: guitar.images || [],
    metadata: {
      guitarBrand: guitar.brand,
      guitarModel: guitar.model,
      guitarYear: guitar.year,
      serialNumber: guitar.privateInfo?.serialNumber || null,
      countryOfOrigin: guitar.countryOfOrigin || null,
    },
  };
}

async function generateSalesHeadline(context) {
  const extras = [];
  if (context.basic.caseIncluded) extras.push('w/ Case');
  if (context.basic.countryOfOrigin) extras.push(context.basic.countryOfOrigin);

  const prompt = `You are writing a compelling sales headline for a guitar listing on marketplaces like Reverb or eBay.

Guitar details:
- Brand: ${context.basic.brand}
- Model: ${context.basic.model}
- Year: ${context.basic.year}
- Condition: ${context.basic.condition || 'Excellent'}
- Color/Finish: ${context.basic.color} ${context.basic.finish}
- Extras: ${extras.join(', ') || 'None'}
- Pickups: ${context.coreSpecs.pickupConfiguration || 'Stock'}

Create a short, attention-grabbing headline (8-12 words) that:
1. Includes year, brand, and model
2. Highlights the condition or a key feature (like pickups, origin, case)
3. Is compelling but honest
4. Follows marketplace best practices

Return ONLY the headline text, no quotes or extra formatting.`;

  return await invokeNova(prompt, { temperature: 0.7 });
}

async function generateSalesDescription(context) {
  const notesText = context.notes.map(n => n.content).join(' ');

  // Build condition disclosure section
  let conditionSection = `Condition: ${context.basic.condition || 'Excellent'}`;
  if (context.conditionReport) {
    const { issues } = context.conditionReport;
    if (issues && issues.length > 0) {
      conditionSection += `\n\nDocumented condition issues:\n${issues.map(i =>
        `- ${i.type} (${i.severity}): ${i.note || 'No details'} [${i.location}]`
      ).join('\n')}`;
    }
  }

  // Include document content if available
  const docContext = context.documentContent?.length > 0
    ? `\n\nFrom attached documentation:\n${context.documentContent.map(d =>
        d.extractedText || d.description || ''
      ).filter(Boolean).join('\n').substring(0, 1000)}`
    : '';

  const prompt = `You are writing a compelling sales description for a guitar listing.

Guitar details:
- Brand: ${context.basic.brand}
- Model: ${context.basic.model}
- Year: ${context.basic.year}
- Type: ${context.basic.type}
- Country of Origin: ${context.basic.countryOfOrigin || 'Not specified'}
- Case Included: ${context.basic.caseIncluded ? 'Yes' : 'No'}
- Serial: ${context.basic.serialNumber || 'Available upon request'}

${conditionSection}

Core Specifications:
${JSON.stringify(context.coreSpecs, null, 2)}

Detailed Specifications:
${JSON.stringify(context.detailedSpecs, null, 2)}

Owner notes: ${notesText || 'None provided'}
${docContext}

Write an engaging sales description (3-5 paragraphs) that:
1. Opens with why this guitar is special
2. Describes the tone, playability, and feel based on specs (woods, pickups, etc.)
3. Mentions notable features and specifications
4. Addresses condition HONESTLY - if there are documented issues, mention them transparently
5. Creates emotional connection while staying factual
6. Mentions what's included (case, etc.)
7. Uses marketplace-friendly language
8. Ends with a call to action

Return ONLY the description text with paragraph breaks.`;

  return await invokeNova(prompt, { temperature: 0.7 });
}

async function generateSalesFeatures(context) {
  // Build extras list
  const extras = [];
  if (context.basic.caseIncluded) extras.push('Original case included');
  if (context.basic.countryOfOrigin) extras.push(`Made in ${context.basic.countryOfOrigin}`);

  const prompt = `You are creating a bullet-point feature list for a guitar sales listing.

Core specifications:
${JSON.stringify(context.coreSpecs, null, 2)}

Detailed specifications:
${JSON.stringify(context.detailedSpecs, null, 2)}

Basic details:
${JSON.stringify(context.basic, null, 2)}

Extras/Includes: ${extras.join(', ') || 'Guitar only'}

Create a concise list of 6-10 key selling points that:
1. Highlights premium features (tonewoods, pickups, hardware)
2. Includes technical specs buyers care about (scale length, frets, radius)
3. Mentions origin and what's included
4. Notes unique characteristics
5. Is easy to scan
6. Uses marketplace-friendly language

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

Core specifications:
${JSON.stringify(context.coreSpecs, null, 2)}

Detailed specifications:
${JSON.stringify(context.detailedSpecs, null, 2)}

Basic info:
${JSON.stringify(context.basic, null, 2)}

Create a clean, easy-to-read specs section with ALL key details buyers care about.
Include every specification provided - do not omit data.

Return ONLY valid JSON (no markdown, no explanations) with this structure:
{
  "body": { "key": "value" pairs for body material, shape, binding, top, finish },
  "neck": { "key": "value" pairs for neck material, fretboard, frets, scale length, nut, profile },
  "electronics": { "key": "value" pairs for pickups, controls, wiring },
  "hardware": { "key": "value" pairs for bridge, tuners, tailpiece, hardware finish },
  "other": { "key": "value" pairs for origin, case included, weight, etc. }
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
