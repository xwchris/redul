'use strict'

const path = require('path')
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development'

module.exports = {
    mode,
    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: `redul.${mode}.js`,
        publicPath: '/',
        library: 'Redul',
        libraryTarget: 'umd'
    },
    module: {
        rules: [
            {
                test: /\.ts/,
                loader: 'babel-loader'
            }
        ]
    },
    resolve: {
        extensions: ['.ts', 'tsx', '.js', '.jsx', '.json', '.css']
    },
    devtool: mode === 'production' ? 'hidden-source-map' : 'cheap-module-eval-source-map'
}
