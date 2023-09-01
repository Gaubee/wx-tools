// ex. scripts/build_npm.ts
import { build, emptyDir } from "https://deno.land/x/dnt/mod.ts";

await emptyDir("./node/admin");

await build({
    entryPoints: ["./admin.node.ts"],
    outDir: "./node/admin",
    typeCheck: false,
    test: false,
    scriptModule: false,
    shims: {
        // see JS docs for overview and more options
        deno: true,
    },
    packageManager: "pnpm",
    package: {
        // package.json properties
        name: "your-package",
        version: Deno.args[0],
        description: "Your package.",
        license: "MIT",
        repository: {
            type: "git",
            url: "git+https://github.com/username/repo.git",
        },
        bugs: {
            url: "https://github.com/username/repo/issues",
        },
        devDependencies: {
            "@types/minimist": "*",
            "@types/ws": "*",
        },
    },
    postBuild() {
        // steps to run after building and before running the tests
        // Deno.copyFileSync("LICENSE", "npm/LICENSE");
        // Deno.copyFileSync("README.md", "npm/README.md");
    },
});
