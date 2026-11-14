/**
 * Load backend/template.yaml with CloudFormation short-form tags (!Ref, !Sub,
 * ...) mapped to their long-form objects, for template assertion tests.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const TAGS = {
  Ref: 'Ref',
  Sub: 'Fn::Sub',
  GetAtt: 'Fn::GetAtt',
  If: 'Fn::If',
  Equals: 'Fn::Equals',
  Not: 'Fn::Not',
  And: 'Fn::And',
  Or: 'Fn::Or',
  Join: 'Fn::Join',
  Select: 'Fn::Select',
  Split: 'Fn::Split',
  FindInMap: 'Fn::FindInMap',
  Base64: 'Fn::Base64',
  ImportValue: 'Fn::ImportValue',
  GetAZs: 'Fn::GetAZs',
  Condition: 'Condition',
};

const types = [];
for (const [tag, key] of Object.entries(TAGS)) {
  for (const kind of ['scalar', 'sequence', 'mapping']) {
    types.push(new yaml.Type(`!${tag}`, {
      kind,
      construct: (data) => {
        if (tag === 'GetAtt' && typeof data === 'string') {
          return { [key]: data.split('.') };
        }
        return { [key]: data };
      },
    }));
  }
}

const SCHEMA = yaml.DEFAULT_SCHEMA.extend(types);

function loadTemplate() {
  const file = path.join(__dirname, '..', '..', 'template.yaml');
  return yaml.load(fs.readFileSync(file, 'utf8'), { schema: SCHEMA });
}

function functionsOf(template) {
  return Object.entries(template.Resources)
    .filter(([, r]) => r.Type === 'AWS::Serverless::Function')
    .map(([name, r]) => ({ name, ...r }));
}

module.exports = { loadTemplate, functionsOf };
