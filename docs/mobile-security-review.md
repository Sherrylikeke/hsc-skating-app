# Mobile internal-test dependency review · 2026-10-20

The SDK-compatible lockfile was installed using Expo's own compatibility resolver: Expo 58.0.16, React Native 0.88.0, React 19.3.0, SecureStore and Notifications. Both native JavaScript/Hermes exports were produced locally. No EAS upload, signed binary, store submission or real-device acceptance is implied.

`npm audit` reports **22 dependency-tree findings: 15 high and 7 moderate, no critical**, including inherited findings reported against Expo/Metro/React Native. Root advisory packages in the captured report are:

- `braces <=3.0.3`: deeply nested glob pattern stack exhaustion ([GitHub reviewed advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)). The official npm registry still reported 3.0.3 as latest during this review; no patched release was installed or claimed.
- `node-forge <=1.4.0`: RSA PKCS#1 signature-verification issue ([GitHub reviewed advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv)). The official registry reported 1.4.0 as latest; no patched release was installed or claimed.
- Older transitive `uuid` versions: supplied-buffer bounds checking for selected UUID algorithms ([GitHub reviewed advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq)). A current major exists, but forcing it into SDK dependencies would cross compatibility boundaries and was not done blindly.

These findings are **not resolved**. Much of the inherited tree involves the native build/development toolchain, but this review does not assert every affected path is absent from runtime. No arbitrary third-party project, glob input, certificate or update payload is accepted by this implementation. No custom OTA update or third-party signing/certificate verification was added. Development startup binds localhost by default; do not expose Metro to the public internet or run untrusted projects.

The audit's proposed major downgrades to obsolete Expo/RN versions were not applied. Reassess maintained SDK releases and upstream fixes, trace remaining runtime reachability and repeat auditing/testing before distributing signed production builds. This is an explicit internal-test/release gate, not a clean bill of security.

Authentication uses the existing server and signed library sessions, not privileged embedded keys. Tokens use platform SecureStore. Membership scope is rechecked on every server request, including native requests. Self-reported email is insufficient: approved password accounts still need an administrator-delivered invitation or explicit dual-session linking before accessing private records. Production signing secrets are stored only in Sites Secrets.
