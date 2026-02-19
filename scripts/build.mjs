import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");

function runTsc() {
    const tscPath = path.join(ROOT, "node_modules", "typescript", "bin", "tsc");
    const result = spawnSync(process.execPath, [tscPath, "-p", "tsconfig.json"], {
        cwd: ROOT,
        stdio: "inherit"
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function copyStaticAssets() {
    const assets = [
        "module.json",
        "maestro.css",
        "lang",
        "templates",
        "sounds",
        "LICENSE",
        "README.md",
        "CHANGELOG.md"
    ];

    for (const asset of assets) {
        const source = path.join(ROOT, asset);
        if (!existsSync(source)) {
            continue;
        }

        const destination = path.join(DIST, asset);
        cpSync(source, destination, { recursive: true });
    }
}

function normalizeDistManifest() {
    const manifestPath = path.join(DIST, "module.json");
    if (!existsSync(manifestPath)) {
        return;
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (Array.isArray(manifest.esmodules)) {
        manifest.esmodules = manifest.esmodules.map((entry) =>
            typeof entry === "string" ? entry.replace(/^\.\/*dist\//, "./") : entry
        );
    }

    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function main() {
    rmSync(DIST, { recursive: true, force: true });
    mkdirSync(DIST, { recursive: true });

    runTsc();
    copyStaticAssets();
    normalizeDistManifest();
}

main();
