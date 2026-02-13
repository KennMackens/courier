const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const MACH_O_REGEX = /Mach-O/;
const BINARY_EXTENSIONS = new Set([".dylib", ".so", ".node"]);
const BUNDLE_SUFFIXES = [".app", ".framework", ".xpc"];

function walkFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        out.push(fullPath);
      }
    }
  }
  return out;
}

function isExecutable(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return (stat.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

function isMachO(filePath) {
  try {
    const out = execFileSync("file", ["-b", filePath], { encoding: "utf8" });
    return MACH_O_REGEX.test(out);
  } catch {
    return false;
  }
}

function sign(identity, entitlementsPath, targetPath) {
  execFileSync(
    "codesign",
    [
      "--force",
      "--sign",
      identity,
      "--timestamp",
      "--options",
      "runtime",
      "--entitlements",
      entitlementsPath,
      targetPath
    ],
    { stdio: "inherit" }
  );
}

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);

  const identity =
    process.env.CSC_NAME ||
    process.env.CSC_IDENTITY ||
    "Developer ID Application";
  const inheritEntitlements = path.join(__dirname, "entitlements.mac.inherit.plist");
  const appEntitlements = path.join(__dirname, "entitlements.mac.plist");

  const allFiles = walkFiles(appPath);
  const machoFiles = allFiles.filter((filePath) => {
    const ext = path.extname(filePath);
    if (BINARY_EXTENSIONS.has(ext) || isExecutable(filePath)) {
      return isMachO(filePath);
    }
    return false;
  });

  // Deepest first so nested code is signed before parent bundles.
  machoFiles.sort((a, b) => b.length - a.length);

  for (const filePath of machoFiles) {
    sign(identity, inheritEntitlements, filePath);
  }

  const bundles = [];
  for (const filePath of allFiles) {
    for (const suffix of BUNDLE_SUFFIXES) {
      const idx = filePath.indexOf(suffix + path.sep);
      if (idx !== -1) {
        bundles.push(filePath.slice(0, idx + suffix.length));
      }
    }
  }

  const uniqueBundles = Array.from(new Set(bundles))
    .filter((bundlePath) => bundlePath !== appPath)
    .sort((a, b) => b.length - a.length);

  for (const bundlePath of uniqueBundles) {
    sign(identity, inheritEntitlements, bundlePath);
  }

  sign(identity, appEntitlements, appPath);

  execFileSync(
    "codesign",
    ["--verify", "--deep", "--strict", "--verbose=2", appPath],
    { stdio: "inherit" }
  );
};
