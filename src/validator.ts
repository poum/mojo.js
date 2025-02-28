import type {JSONObject, ValidatorFunction} from './types.js';
import type {ValidateFunction} from 'ajv';
import {ValidatorResult} from './validator/result.js';
import Ajv from 'ajv';

export class Validator {
  _ajv = new Ajv();

  addSchema(schema: JSONObject, name?: string): void {
    this._ajv.addSchema(schema, name);
  }

  schema(schema: JSONObject | string): ValidatorFunction | null {
    const ajv = this._ajv;

    let validate: ValidateFunction | undefined;
    if (typeof schema === 'string') {
      validate = ajv.getSchema(schema);
    } else if (schema.$id !== undefined) {
      if ((validate = ajv.getSchema(schema.$id as string)) === undefined) validate = ajv.compile(schema);
    } else {
      validate = ajv.compile(schema);
    }
    if (validate === undefined) return null;

    return function (data: JSONObject): ValidatorResult {
      const isValid = (validate as ValidateFunction)(data);

      const errors = [];
      const results = (validate as ValidateFunction).errors;
      if (results != null) {
        for (const error of results) {
          errors.push({instancePath: error.instancePath, schemaPath: error.schemaPath, message: error.message});
        }
      }

      return new ValidatorResult(isValid, errors);
    };
  }
}
