#!/usr/bin/env python3
"""Package the current game with the Android SDK and sign the APK."""

import argparse
import base64
import os
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ANDROID = Path(__file__).resolve().parent
NAMESPACE = "{http://schemas.android.com/apk/res/android}"


def run(*command):
    subprocess.run(command, check=True)


def game_assets(staging):
    assets = staging / "assets"
    assets.mkdir()
    game = ANDROID.parent / "index.html"
    html = game.read_text(encoding="utf-8")
    version = re.search(r"(?m)^var VER='(\d+)\.(\d+)(?:\.(\d+))?'", html)
    icon = re.search(r'"verity1"\s*:\s*"data:image/png;base64,([A-Za-z0-9+/=]+)"', html)
    if not version or not icon:
        raise ValueError("The game must contain the release version and the Verity launcher art.")
    numbers = [int(number or 0) for number in version.groups()]
    if numbers[1] >= 1000 or numbers[2] >= 1000:
        raise ValueError("The Android version code supports minor and patch numbers below 1000.")
    version_name = ".".join(number for number in version.groups() if number is not None)
    version_code = numbers[0] * 1_000_000 + numbers[1] * 1000 + numbers[2]
    shutil.copyfile(game, assets / "index.html")
    drawable = staging / "res" / "drawable-nodpi"
    drawable.mkdir(parents=True)
    (drawable / "launcher.png").write_bytes(base64.b64decode(icon[1], validate=True))
    return version_name, str(version_code)


def main():
    sdk_home = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sdk", type=Path, default=sdk_home, required=not sdk_home)
    parser.add_argument("--build-tools", default="35.0.0")
    parser.add_argument("--keystore", type=Path, required=True)
    parser.add_argument("--key-alias", default="verity")
    parser.add_argument("--password-file", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True, help="Path to the signed APK")
    args = parser.parse_args()

    manifest = ANDROID / "AndroidManifest.xml"
    platforms = ET.parse(manifest).getroot().find("uses-sdk")
    minimum = platforms.attrib[NAMESPACE + "minSdkVersion"]
    target = platforms.attrib[NAMESPACE + "targetSdkVersion"]
    platform = args.sdk / "platforms" / ("android-" + target) / "android.jar"
    tools = args.sdk / "build-tools" / args.build_tools
    javac = ["javac"] if shutil.which("javac") else ["java", "-m", "jdk.compiler/com.sun.tools.javac.Main"]

    for dependency in (platform, tools / "aapt2", tools / "d8", tools / "zipalign",
                       tools / "apksigner", args.keystore, args.password_file):
        if not dependency.is_file():
            parser.error(f"Missing file {dependency}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="verity-android-") as temporary:
        staging = Path(temporary)
        version, code = game_assets(staging)
        resources = staging / "resources.zip"
        unsigned = staging / "unsigned.apk"
        aligned = staging / "aligned.apk"
        classes = staging / "classes"
        classes.mkdir()

        run(tools / "aapt2", "compile", "--dir", staging / "res", "-o", resources)
        run(tools / "aapt2", "link", "-I", platform, "--manifest", manifest,
            "-A", staging / "assets", "--version-name", version, "--version-code", code,
            resources, "-o", unsigned)
        run(*javac, "-source", "8", "-target", "8", "-Xlint:-options", "-classpath", platform,
            "-d", classes, ANDROID / "GameActivity.java")
        run(tools / "d8", "--release", "--min-api", minimum, "--lib", platform,
            "--output", staging, *sorted(classes.rglob("*.class")))
        with ZipFile(unsigned, "a", compression=ZIP_DEFLATED) as archive:
            archive.write(staging / "classes.dex", "classes.dex")

        run(tools / "zipalign", "-f", "4", unsigned, aligned)
        run(tools / "apksigner", "sign", "--ks", args.keystore,
            "--ks-key-alias", args.key_alias, "--ks-pass", "file:" + str(args.password_file),
            "--v4-signing-enabled", "false", "--out", args.out, aligned)
        run(tools / "apksigner", "verify", args.out)
    print(f"Android {version} APK: {args.out.resolve()}")


if __name__ == "__main__":
    main()
