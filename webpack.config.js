const path = require('path');

module.exports = {
  entry: './example/src/index',
  output: {
    path: path.resolve(__dirname, 'example/dist'),
    filename: 'index.js'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json']
  },

  module: {
    rules: [{
      // Include ts, tsx, and js files.
      test: /\.(tsx?)|(js)$/,
      exclude: /node_modules/,
      loader: 'babel-loader',
    }],
  },

  devServer: {
    contentBase: path.join(__dirname, 'example/dist'),
    port: 9000
  }
};
