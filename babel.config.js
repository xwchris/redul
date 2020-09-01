module.exports = {
    presets: [
        '@babel/preset-typescript',
        '@babel/preset-env',
    ],
    plugins: [
        ['@babel/plugin-transform-react-jsx', { pragma: 'Redul.createElement' }],
    ]
};
