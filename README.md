![Foundry VTT 14.360](https://img.shields.io/badge/Foundry%20VTT-14.360-green)
![GitHub downloads (latest)](https://img.shields.io/github/downloads-pre/MemelyPepeartly/maestro-revived/latest/module.zip)

# Maestro Revived

[Installation](#installation)

[Module Manifest](https://github.com/MemelyPepeartly/maestro-revived/releases/latest/download/module.json)

[Changelog](https://github.com/MemelyPepeartly/maestro-revived/blob/main/CHANGELOG.md)

Adds sound-focused features to Foundry Virtual Tabletop.

**Maestro Revived** adds the following features:

* **Hype Track** - Set a track to play each time that Actor has a turn in Combat.
* **Item Track** - Set a track to play when that Item is rolled.
* **Combat Track** - Set a playlist or track to play when the Combat encounter begins.
* **Miscellaneous** - Playlist loop toggling, disable dice sound setting, critical/failure sounds.
* **Deprecated Scene Playlist** - Use native Foundry functionality instead.

## Usage

### Hype Track

Add Hype Tracks to the **Hype Tracks** Playlist that is automatically created by the module.

Set a Hype Track on the desired Actor by clicking the Hype button, then selecting the track.

### Item Track

Add Item Tracks to the **Item Tracks** Playlist that is automatically created by the module.

Set an Item Track on the desired Item by clicking the Item Track button, then selecting the track.

## Combat Track

Set a playlist or track to play when the Combat encounter begins.

## Installation

1. Navigate to the Foundry Setup screen and click on the Modules tab.
2. Click Install Module and paste in the following link: https://github.com/MemelyPepeartly/maestro-revived/releases/latest/download/module.json
3. Once **Maestro Revived** is installed, open your world and navigate to `Game Settings` > `Configure Settings` > `Module Settings` and enable the settings you want.

The package id remains `maestro` for compatibility with existing worlds, settings, flags, and module asset paths. Release, manifest, download, issue, and README links point to this revived fork.

## Development

1. Install dependencies: `npm install`
2. Build TypeScript sources to `dist/`: `npm run build`
3. Run type checks only: `npm run typecheck`
4. Runtime JavaScript is generated in `dist/` and is not committed to source control.

## Issues/Feedback

Create an issue here: [Issue Log](https://github.com/MemelyPepeartly/maestro-revived/issues).

## Donations

Click the Sponsor button at the top of the GitHub repo.

## Attributions

Critical sound: "Ta da" by Mike Koenig http://soundbible.com/1003-Ta-Da.html

Failure sound: "Cartoon fail or sad trumpet 2" from https://zapsplat.com

**Originally developed by**: Evan Clarke (errational)

**Revived development by**: Memely Pepeartly

**Previously featured code by**: @kakaroto
