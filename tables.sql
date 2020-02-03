CREATE TABLE `server` (
  `name` varchar(32) NOT NULL,
  `pid` int(11) DEFAULT NULL,
  `uid` int(11) DEFAULT NULL,
  `gid` int(11) DEFAULT NULL,
  `webPort` int(11) DEFAULT NULL,
  `rconPort` int(11) DEFAULT NULL,
  `mcPort` int(11) DEFAULT NULL,
  `queryPort` int(11) DEFAULT NULL,
  `state` int(1) NOT NULL DEFAULT '0',
  `online` int(11) NOT NULL DEFAULT '0',
  `path` varchar(255) DEFAULT NULL,
  `jarPath` varchar(255) DEFAULT NULL,
  `worldPath` varchar(255) DEFAULT NULL,
  `startParams` longtext,
  `properties` longtext,
  `rconEnabled` int(11) DEFAULT '0',
  `rconPassword` varchar(255) DEFAULT NULL,
  `queryEnabled` int(1) NOT NULL DEFAULT '0',
  `maxRam` varchar(4) DEFAULT NULL,
  `maxPlayers` int(11) DEFAULT NULL,
  `autoStart` int(1) NOT NULL DEFAULT '0',
  `lastStart` int(11) DEFAULT NULL,
  `lastActive` int(11) DEFAULT NULL,
  `authKey` varchar(32) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `uuids` (
  `uuid` varchar(32) NOT NULL,
  `last_name` varchar(16) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;