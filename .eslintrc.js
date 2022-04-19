module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    // Lintの時間があまりに長いようなら無効化も考える
    'plugin:@typescript-eslint/recommended-requiring-type-checking',

    'plugin:import/errors',
    'plugin:import/typescript',
  ],
  parserOptions: {
    project: './tsconfig.json',
    ecmaVersion: 'next',
    sourceType: 'module',
    ecaFeatures: {
      jsx: true,
    },
  },
  rules: {
    curly: 'error',
    eqeqeq: ['error', 'smart'],

    'no-return-await': 'error',
    'require-await': 'error',
    'no-await-in-loop': 'error',

    '@typescript-eslint/prefer-readonly': 'error',
    // '@typescript-eslint/prefer-readonly-parameter-types': ["error", {ignoreInferredTypes: true}],
    '@typescript-eslint/array-type': ['error', {default: 'generic', readonly: 'generic'}],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
      },
    ],

    'padding-line-between-statements': [
      'error',
      {blankLine: 'always', prev: 'multiline-const', next: 'multiline-const'},
      {blankLine: 'always', prev: '*', next: 'function'},
      {blankLine: 'always', prev: '*', next: 'class'},
      {blankLine: 'always', prev: '*', next: 'export'},
    ],

    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': ['error'],

    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        vars: 'all',
        args: 'none',
        ignoreRestSiblings: true,

        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],

    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',

    // 要検討
    '@typescript-eslint/no-unsafe-assignment': 'off',
    // voidとのunionで微妙な挙動をするので一旦停止
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksVoidReturn: false,
      },
    ],

    'import/newline-after-import': 'error',
    'import/named': 'off',
    'import/no-named-default': 'error',
    'import/no-default-export': 'off',
    'import/default': 'off',
    'import/no-useless-path-segments': 'error',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', ['index', 'sibling'], 'type'],
        'newlines-between': 'always-and-inside-groups',
        alphabetize: {
          order: 'asc' /* sort in ascending order. Options: ['ignore', 'asc', 'desc'] */,
          caseInsensitive: true /* ignore case. Options: [true, false] */,
        },
      },
    ],

  },
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.js', '.jsx', '.ts', '.tsx'],
    },

    'import/ignore': ['node_modules'],
  },
};
