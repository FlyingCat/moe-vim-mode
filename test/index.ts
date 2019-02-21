mocha.setup('tdd');

declare let require: any;

const testsContext = require.context(".", true, /\.test\.ts$/);

testsContext.keys().forEach(testsContext);
