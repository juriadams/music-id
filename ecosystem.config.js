module.exports = {
    apps: [
        {
            name: "music-id",
            script: "dist/index.js",
            instances: "1",
            exec_mode: "cluster_mode",
        },
    ],
};
