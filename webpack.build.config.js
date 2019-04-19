const path = require('path');

module.exports = {
    mode: 'production',
    entry: './src/index.ts',
    output: {
        filename: 'moe-vim-mode.js',
        path: path.resolve(__dirname, 'dist'),
        library: 'moeVim',
        libraryTarget: 'umd',
    },
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
        extensions: ['.tsx', '.ts', '.js']
    },
    externals: {
        'monaco-editor': {
            root: 'monaco',
            commonjs: 'monaco-editor',
            commonjs2: 'monaco-editor',
            amd: 'vs/editor/editor.main',
        },
    },
    devtool: 'source-map'
};
