import { linter } from '@codemirror/lint';
import { EditorView } from '@uiw/react-codemirror';
import addFormats from 'ajv-formats';
import Ajv, { SchemaObject } from 'ajv/dist/2020';
import { groupBy } from '../../../util';
import { getJsonPointers } from './pointers';

const FEATURE_SCHEMA = { $ref: 'https://beta.schemas.opengis.net/json-fg/feature.json' };
const FEATURECOLLECTION_SCHEMA = { $ref: 'https://beta.schemas.opengis.net/json-fg/featurecollection.json' };

const ajv = new Ajv({
  loadSchema: async url => {
    const response = await fetch(url.replace('https://beta.schemas.opengis.net/json-fg/', 'schemas/'));
    return response.json();
  },
});

addFormats(ajv);

const schemaValidation = linter((view: EditorView) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let doc: any;

  try {
    doc = JSON.parse(view.state.doc.toString());
  } catch {
    return [];
  }

  let docSchema: SchemaObject;

  if (doc.type === 'Feature') {
    docSchema = FEATURE_SCHEMA;
  } else if (doc.type === 'FeatureCollection') {
    docSchema = FEATURECOLLECTION_SCHEMA;
  } else {
    return [];
  }

  return ajv.compileAsync(docSchema).then(validate => {
    const valid = validate(doc);

    if (!valid) {
      const pointers = getJsonPointers(view.state);
      const errorsByPath = groupBy(validate.errors!, error => error.instancePath);

      return Object.entries(errorsByPath).map(([path, errors]) => {
        const coordinates = pointers.get(path)!;

        return {
          from: coordinates.valueFrom,
          to: coordinates.valueTo,
          severity: 'error',
          message: errors.map(error => error.instancePath + ': ' + error.message!).join('\n'),
        };
      });
    }

    return [];
  });
});

export default schemaValidation;
