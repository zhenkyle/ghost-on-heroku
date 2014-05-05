var schema    = require('../schema').tables,
    _         = require('lodash'),
    validator = require('validator'),
    when      = require('when'),

    validateSchema,
    validateSettings,
    validate;

// Provide a few custom validators
//
validator.extend('empty', function (str) {
    return _.isEmpty(str);
});

validator.extend('notContains', function (str, badString) {
    return !_.contains(str, badString);
});

// Validation validation against schema attributes
// values are checked against the validation objects
// form schema.js
validateSchema = function (tableName, model) {
    var columns = _.keys(schema[tableName]),
        errors = [];

    _.each(columns, function (columnKey) {
        var message = '';
        // check nullable
        if (model.hasOwnProperty(columnKey) && schema[tableName][columnKey].hasOwnProperty('nullable')
                && schema[tableName][columnKey].nullable !== true) {
            if (validator.isNull(model[columnKey]) || validator.empty(model[columnKey])) {
                message = 'Value in [' + tableName + '.' + columnKey + '] cannot be blank.';
                errors.push({type: 'ValidationError', property: tableName + '.' + columnKey, message: message});
            }
        }
        // TODO: check if mandatory values should be enforced
        if (model[columnKey]) {
            // check length
            if (schema[tableName][columnKey].hasOwnProperty('maxlength')) {
                if (!validator.isLength(model[columnKey], 0, schema[tableName][columnKey].maxlength)) {
                    message = 'Value in [' + tableName + '.' + columnKey + '] exceeds maximum length of '
                        + schema[tableName][columnKey].maxlength + ' characters.';
                    errors.push({type: 'ValidationError', property: tableName + '.' + columnKey, message: message});
                }
            }

            //check validations objects
            if (schema[tableName][columnKey].hasOwnProperty('validations')) {
                errors.concat(validate(model[columnKey], columnKey, schema[tableName][columnKey].validations));
            }

            //check type
            if (schema[tableName][columnKey].hasOwnProperty('type')) {
                if (schema[tableName][columnKey].type === 'integer' && !validator.isInt(model[columnKey])) {
                    message = 'Value in [' + tableName + '.' + columnKey + '] is no valid integer.';
                    errors.push({type: 'ValidationError', property: tableName + '.' + columnKey, message: message});
                }
            }
        }
    });

    if (errors.length !== 0) {
        return when.reject(errors);
    }
};

// Validation for settings
// settings are checked against the validation objects
// form default-settings.json
validateSettings = function (defaultSettings, model) {
    var values = model.toJSON(),
        matchingDefault = defaultSettings[values.key];

    if (matchingDefault && matchingDefault.validations) {
        return validate(values.value, values.key, matchingDefault.validations);
    }
};

// Validate default settings using the validator module.
// Each validation's key is a method name and its value is an array of options
//
// eg:
//      validations: { isUrl: true, isLength: [20, 40] }
//
// will validate that a setting's length is a URL between 20 and 40 chars.
//
// If you pass a boolean as the value, it will specify the "good" result. By default
// the "good" result is assumed to be true.
//
// eg:
//      validations: { isNull: false }  // means the "good" result would
//                                      // fail the `isNull` check, so
//                                      // not null.
//
// available validators: https://github.com/chriso/validator.js#validators
validate = function (value, key, validations) {
    var errors = [];
    _.each(validations, function (validationOptions, validationName) {
        var goodResult = true;

        if (_.isBoolean(validationOptions)) {
            goodResult = validationOptions;
            validationOptions = [];
        } else if (!_.isArray(validationOptions)) {
            validationOptions = [validationOptions];
        }

        validationOptions.unshift(value);

        // equivalent of validator.isSomething(option1, option2)
        if (validator[validationName].apply(validator, validationOptions) !== goodResult) {
            errors.push({type: 'ValidationError', property: key, message: 'Settings validation (' + validationName + ') failed for ' + key});
        }

        validationOptions.shift();
    }, this);

    if (errors.length !== 0) {
        return when.reject(errors);
    }
};

module.exports = {
    validateSchema: validateSchema,
    validateSettings: validateSettings
};
