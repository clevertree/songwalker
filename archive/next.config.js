const path = require("path");
/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, options) => {
        config.module.rules.push({
            test: /\.(sw)$/,
            use: [{
                loader: path.join(process.cwd(), 'songwalker/build/loader/fileLoader.js')
            }]
        })

        return config
    },
}

module.exports = nextConfig
