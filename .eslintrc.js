module.exports = {
    "globals": {
        "assert": false
    },
    "env": {
        "mocha": true,
        "es6": true,
        "node": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "sourceType": "module"
    },
    "rules": {
        "indent": [
            "error",
            4
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "double"
        ],
        "semi": [
            "error",
            "always"
        ],
        "no-console": "off",
        "comma-dangle": "off",
        "no-unused-vars": "off",
        "javascript:UnusedVariable": "off"
    }
};