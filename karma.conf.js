// Karma configuration

module.exports = function (config) {
    config.set({
        basePath: '',

        frameworks: ['mocha'],

        files: [
            { pattern: 'node_modules/monaco-editor/min/vs/editor/editor.main.css', watched: false },
            { pattern: 'test/resource/env.js', watched: false },
            { pattern: 'node_modules/monaco-editor/min/vs/loader.js', watched: false },
            { pattern: 'node_modules/monaco-editor/min/vs/editor/editor.main.nls.js', watched: false },
            { pattern: 'node_modules/monaco-editor/min/vs/editor/editor.main.js', watched: false },
            { pattern: 'node_modules/monaco-editor/min/vs/**/*.js', watched: false, included: false },
            { pattern: 'node_modules/monaco-editor/min-maps/vs/**/*.js.map', watched: false, included: false },
            'test/index.ts'
        ],

        preprocessors: {
            'test/index.ts': ['webpack', 'sourcemap']
        },

        webpack: {
            mode: 'development',
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
                'monaco-editor': 'monaco'
            },
            devtool: 'inline-source-map',
        },

        reporters: ['dots'],

        // browsers: ['Chrome'],
        browsers: ['ChromeHeadless'],
    })
}
