const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
    mode: 'development',
    entry: {
        demo: './demo/demo.ts',
    },
    devtool: process.env.NODE_ENV === 'development' ? 'inline-source-map' : undefined,
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        alias: {
            'moe-vim-mode': path.join(__dirname, 'src')
        }
    },
    plugins: [
        new CopyWebpackPlugin([{
            from: './demo/index.html',
            to: './',
        }])
    ],
    externals: {
        'monaco-editor': 'monaco'
    },
};
