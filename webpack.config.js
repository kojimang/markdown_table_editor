const path = require('path');

//@ts-check

/** @type {import('webpack').Configuration} */
const extensionConfig = {
  target: 'node',
  mode: 'none',
  entry: {
    extension: './src/extension.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  devtool: 'nosources-source-map'
};

/** @type {import('webpack').Configuration} */
const webviewConfig = {
  target: 'web', // Webview runs in browser
  mode: 'development', // Change to production for release
  entry: {
    webview: './src/webview/index.tsx'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'webview.js', 
    libraryTarget: 'umd' // UMD for browser compatibility
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.css']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  devtool: 'source-map' // Helpful for debugging webview
};

module.exports = [extensionConfig, webviewConfig];
