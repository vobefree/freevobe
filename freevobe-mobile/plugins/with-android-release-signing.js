/**
 * Signerar release-APK:n med ett riktigt nyckellager i stället för debugnyckeln.
 *
 * `expo prebuild` skapar `android/` från grunden och pekar då release-varianten på debugnyckeln
 * ("Caution! In production, you need to generate your own keystore file."). Allt i `android/` skrivs
 * över vid varje prebuild, så ändringen görs som en config plugin i stället – det är Expos
 * rekommenderade sätt (Continuous Native Generation).
 *
 * Pluginen lägger ett `android { … }`-block sist i `android/app/build.gradle`. Gradle tillåter att
 * android-blocket konfigureras flera gånger, och den sista tilldelningen av `signingConfig` för
 * release-varianten vinner. Därför behövs ingen textkirurgi inne i de genererade blocken, vilket
 * hade varit känsligt för att React Native ändrar sina kommentarer och sin ordning.
 *
 * Nyckellagret läses från `android/key.properties` – samma filnamn som React Native dokumenterar:
 *
 *   storeFile=app/upload-key.jks
 *   storePassword=…
 *   keyAlias=…
 *   keyPassword=…
 *
 * Filen och .jks-filen ligger under `android/` (gitignorerad) och skrivs i CI från hemligheter.
 * Saknas filen – som vid lokal utveckling – behålls debugnyckeln så att `assembleRelease` fortfarande
 * går att köra. CI verifierar sedan att en APK som skulle vara signerad inte är debug-signerad.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

/** Markör så att blocket bara läggs till en gång, även när prebuild körs utan --clean. */
const MARKER = '// Freevobe: release-APK signeras med nyckellagret i android/key.properties';

const SIGNING_BLOCK = `
${MARKER}
def freevobeKeystorePropertiesFile = rootProject.file("key.properties")
def freevobeKeystoreProperties = new Properties()
if (freevobeKeystorePropertiesFile.exists()) {
    freevobeKeystoreProperties.load(new FileInputStream(freevobeKeystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            if (freevobeKeystorePropertiesFile.exists()) {
                storeFile rootProject.file(freevobeKeystoreProperties["storeFile"])
                storePassword freevobeKeystoreProperties["storePassword"]
                keyAlias freevobeKeystoreProperties["keyAlias"]
                keyPassword freevobeKeystoreProperties["keyPassword"]
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
`;

/**
 * Lägger till signeringsblocket. Idempotent: finns markören redan lämnas filen orörd, så upprepade
 * prebuild-körningar i samma katalog ger inte dubbla block.
 */
function appendSigningBlock(contents) {
  if (contents.includes(MARKER)) return contents;
  return `${contents.trimEnd()}\n${SIGNING_BLOCK}`;
}

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    gradleConfig.modResults.contents = appendSigningBlock(gradleConfig.modResults.contents);
    return gradleConfig;
  });
};

module.exports.appendSigningBlock = appendSigningBlock;
