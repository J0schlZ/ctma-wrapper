# ctma-wrapper
Ich habe NodeJS bisher immer ohne IDE entwickelt.
Wie ich nun feststellen musste, ist der Code wohl nicht so ganz valide.. :'D
Aber er l�uft!^^

Wer Lust hat sich hier rein zu friemeln und zu optimieren ist herzlich dazu eingeladen.
W�rde mich auch �berreden lassen das ganze noch einmal neu zu schreiben.

Schreibt mich gerne in Discord an.
@IrgendSoEinTyp - http://discord.craft-together.de/

## Installation:
1. `config.js` anpassen
2. MySQL-Datenbank und Tabellen anlegen. (`tables.sql`)
3. Eintrag in Tabelle `server` erstellen 

## Ausf�hren:
`app.js <serverName> [arguments]`

## Argumente
- `--forceKill` versucht bereits laufende Instanzen zu stoppen, l�uft der Prozess nach 10 Sek noch wird er gekillt.
- `--forceUpgrade` Startet Bukkit/Spigot mit dem Parameter: `--forceUpgrade` und f�hrt ein Version-Upgrade f�r alle Welten durch.
- `--noRestart` Ignoriere geplante Neustarts

### Tools

Created with [Nodeclipse](https://github.com/Nodeclipse/nodeclipse-1)
 ([Eclipse Marketplace](http://marketplace.eclipse.org/content/nodeclipse), [site](http://www.nodeclipse.org))   

Nodeclipse is free open-source project that grows with your contributions.
