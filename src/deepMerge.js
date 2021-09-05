/*!
 * Deep merge two or more objects together.
 * (c) 2019 Chris Ferdinandi, MIT License, https://gomakethings.com
 * @param   {Object}   objects  The objects to merge together
 * @returns {Object}            Merged values of defaults and options
 */

const deepMerge = function () {
  // Setup merged object
  var newObj = {};

  // Merge the object into the newObj object
  var merge = function (obj) {
    for (var prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        // If property is an object, merge properties
        if (Object.prototype.toString.call(obj[prop]) === "[object Object]") {
          newObj[prop] = deepMerge(newObj[prop], obj[prop]);
        } else {
          newObj[prop] = obj[prop];
        }
      }
    }
  };

  // Loop through each object and conduct a merge
  for (var i = 0; i < arguments.length; i++) {
    merge(arguments[i]);
  }

  return newObj;
};

export default deepMerge;
