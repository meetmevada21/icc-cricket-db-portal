-- ============================================================================
-- ICC Cricket Management System - Complete MySQL Schema, Triggers, Views & Seed
-- Generated from MySQL Workbench ER Diagram
-- ============================================================================

CREATE DATABASE IF NOT EXISTS icc_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE icc_db;

-- Drop existing views and tables in reverse dependency order for clean reload
DROP VIEW IF EXISTS vw_player_rankings;
DROP VIEW IF EXISTS vw_tournament_matches;

DROP TABLE IF EXISTS player_tournaments;
DROP TABLE IF EXISTS player_matches;
DROP TABLE IF EXISTS player_formats;
DROP TABLE IF EXISTS match_teams;
DROP TABLE IF EXISTS tournament_types;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS tournaments;

-- ----------------------------------------------------------------------------
-- 1. Table: tournaments
-- ----------------------------------------------------------------------------
CREATE TABLE tournaments (
    TID INT NOT NULL,
    Tname VARCHAR(255) NOT NULL,
    Tduration VARCHAR(100) NOT NULL,
    PRIMARY KEY (TID),
    INDEX idx_tournaments_name (Tname)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. Table: tournament_types (Composite PK: TID, Ttype)
-- ----------------------------------------------------------------------------
CREATE TABLE tournament_types (
    TID INT NOT NULL,
    Ttype VARCHAR(100) NOT NULL,
    PRIMARY KEY (TID, Ttype),
    INDEX idx_ttype (Ttype),
    CONSTRAINT fk_tournament_types_tid
        FOREIGN KEY (TID) REFERENCES tournaments (TID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. Table: matches
-- ----------------------------------------------------------------------------
CREATE TABLE matches (
    MID INT NOT NULL,
    match_date DATE NOT NULL,
    match_time TIME NOT NULL,
    mType VARCHAR(10) NOT NULL,
    Outcome VARCHAR(255) DEFAULT 'Scheduled',
    TotalRuns INT DEFAULT 0,
    Umpires VARCHAR(255) DEFAULT 'TBA',
    TID INT NULL,
    PRIMARY KEY (MID),
    INDEX idx_matches_tid (TID),
    INDEX idx_matches_date (match_date),
    INDEX idx_matches_mtype (mType),
    CONSTRAINT fk_matches_tid
        FOREIGN KEY (TID) REFERENCES tournaments (TID)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. Table: match_teams (Composite PK: MID, TeamName)
-- ----------------------------------------------------------------------------
CREATE TABLE match_teams (
    MID INT NOT NULL,
    TeamName VARCHAR(100) NOT NULL,
    PRIMARY KEY (MID, TeamName),
    INDEX idx_match_teams_name (TeamName),
    CONSTRAINT fk_match_teams_mid
        FOREIGN KEY (MID) REFERENCES matches (MID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. Table: players
-- ----------------------------------------------------------------------------
CREATE TABLE players (
    PID INT NOT NULL,
    Pname VARCHAR(255) NOT NULL,
    Country VARCHAR(255) NOT NULL,
    Salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (PID),
    INDEX idx_players_country (Country),
    INDEX idx_players_name (Pname)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 6. Table: player_formats (Composite PK: PID, Format)
-- ----------------------------------------------------------------------------
CREATE TABLE player_formats (
    PID INT NOT NULL,
    Format VARCHAR(50) NOT NULL,
    Ranking INT NOT NULL,
    PRIMARY KEY (PID, Format),
    INDEX idx_player_formats_rank (Format, Ranking),
    CONSTRAINT fk_player_formats_pid
        FOREIGN KEY (PID) REFERENCES players (PID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 7. Table: player_matches (Composite PK: PID, MID)
-- ----------------------------------------------------------------------------
CREATE TABLE player_matches (
    PID INT NOT NULL,
    MID INT NOT NULL,
    PRIMARY KEY (PID, MID),
    INDEX idx_player_matches_mid (MID),
    CONSTRAINT fk_player_matches_pid
        FOREIGN KEY (PID) REFERENCES players (PID)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_player_matches_mid
        FOREIGN KEY (MID) REFERENCES matches (MID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 8. Table: player_tournaments (Composite PK: PID, TID)
-- ----------------------------------------------------------------------------
CREATE TABLE player_tournaments (
    PID INT NOT NULL,
    TID INT NOT NULL,
    PRIMARY KEY (PID, TID),
    INDEX idx_player_tournaments_tid (TID),
    CONSTRAINT fk_player_tournaments_pid
        FOREIGN KEY (PID) REFERENCES players (PID)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_player_tournaments_tid
        FOREIGN KEY (TID) REFERENCES tournaments (TID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- TRIGGERS (on `players` and `matches` as indicated in the ER Diagram)
-- ============================================================================

DELIMITER $$

CREATE TRIGGER trg_players_before_insert
BEFORE INSERT ON players
FOR EACH ROW
BEGIN
    IF NEW.Salary < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Player Salary cannot be negative (DECIMAL(12,2) >= 0)';
    END IF;
    SET NEW.Pname = TRIM(NEW.Pname);
    SET NEW.Country = TRIM(NEW.Country);
END$$

CREATE TRIGGER trg_players_before_update
BEFORE UPDATE ON players
FOR EACH ROW
BEGIN
    IF NEW.Salary < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Player Salary cannot be negative (DECIMAL(12,2) >= 0)';
    END IF;
    SET NEW.Pname = TRIM(NEW.Pname);
    SET NEW.Country = TRIM(NEW.Country);
END$$

CREATE TRIGGER trg_matches_before_insert
BEFORE INSERT ON matches
FOR EACH ROW
BEGIN
    IF NEW.TotalRuns < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'TotalRuns cannot be negative';
    END IF;
    IF NEW.Outcome IS NULL OR TRIM(NEW.Outcome) = '' THEN
        SET NEW.Outcome = 'Scheduled';
    END IF;
END$$

CREATE TRIGGER trg_matches_before_update
BEFORE UPDATE ON matches
FOR EACH ROW
BEGIN
    IF NEW.TotalRuns < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'TotalRuns cannot be negative';
    END IF;
END$$

DELIMITER ;

-- ============================================================================
-- VIEWS (`vw_player_rankings` and `vw_tournament_matches`)
-- ============================================================================

CREATE OR REPLACE VIEW vw_player_rankings AS
SELECT
    p.PID,
    p.Pname,
    p.Country,
    p.Salary,
    pf.Format,
    pf.Ranking,
    (SELECT COUNT(*) FROM player_matches pm WHERE pm.PID = p.PID) AS MatchesPlayed,
    (SELECT COUNT(*) FROM player_tournaments pt WHERE pt.PID = p.PID) AS TournamentsPlayed
FROM players p
INNER JOIN player_formats pf ON p.PID = pf.PID
ORDER BY pf.Format ASC, pf.Ranking ASC;

CREATE OR REPLACE VIEW vw_tournament_matches AS
SELECT
    t.TID,
    t.Tname,
    t.Tduration,
    (SELECT GROUP_CONCAT(tt.Ttype ORDER BY tt.Ttype SEPARATOR ', ')
     FROM tournament_types tt WHERE tt.TID = t.TID) AS TournamentTypes,
    m.MID,
    m.match_date,
    m.match_time,
    m.mType,
    (SELECT GROUP_CONCAT(mt.TeamName ORDER BY mt.TeamName SEPARATOR ' vs ')
     FROM match_teams mt WHERE mt.MID = m.MID) AS Teams,
    m.Outcome,
    m.TotalRuns,
    m.Umpires
FROM tournaments t
INNER JOIN matches m ON t.TID = m.TID
ORDER BY m.match_date DESC, m.match_time DESC;

-- ============================================================================
-- SEED DATA (Realistic ICC Tournaments, Matches, Players & Junctions)
-- ============================================================================

INSERT INTO tournaments (TID, Tname, Tduration) VALUES
(101, 'ICC Men''s Cricket World Cup', '46 Days (Oct - Nov)'),
(102, 'ICC Men''s T20 World Cup', '29 Days (Jun)'),
(103, 'ICC World Test Championship Final', '5 Days (Jun)'),
(104, 'ICC Champions Trophy', '19 Days (Feb - Mar)');

INSERT INTO tournament_types (TID, Ttype) VALUES
(101, '50-Over ODI'),
(101, 'Round Robin & Knockout'),
(102, '20-Over T20I'),
(102, 'Group Stage & Super 8'),
(103, '5-Day Test'),
(103, 'Championship Mace Final'),
(104, '50-Over ODI'),
(104, 'Elite 8 Group & Knockout');

INSERT INTO matches (MID, match_date, match_time, mType, Outcome, TotalRuns, Umpires, TID) VALUES
(501, '2023-11-19', '14:00:00', 'ODI', 'Australia won by 6 wickets', 481, 'Richard Illingworth, Richard Kettleborough', 101),
(502, '2023-11-15', '14:00:00', 'ODI', 'India won by 70 runs', 724, 'Rod Tucker, Joel Wilson', 101),
(503, '2024-06-29', '10:30:00', 'T20I', 'India won by 7 runs', 345, 'Chris Gaffaney, Richard Illingworth', 102),
(504, '2024-06-27', '10:30:00', 'T20I', 'India won by 68 runs', 274, 'Chris Gaffaney, Rod Tucker', 102),
(505, '2023-06-07', '10:30:00', 'Test', 'Australia won by 209 runs', 1473, 'Chris Gaffaney, Richard Illingworth', 103),
(506, '2025-03-09', '13:00:00', 'ODI', 'India won by 4 wickets', 505, 'Paul Reiffel, Richard Illingworth', 104);

INSERT INTO match_teams (MID, TeamName) VALUES
(501, 'India'),
(501, 'Australia'),
(502, 'India'),
(502, 'New Zealand'),
(503, 'India'),
(503, 'South Africa'),
(504, 'India'),
(504, 'England'),
(505, 'Australia'),
(505, 'India'),
(506, 'India'),
(506, 'New Zealand');

INSERT INTO players (PID, Pname, Country, Salary) VALUES
(1, 'Virat Kohli', 'India', 850000.00),
(2, 'Jasprit Bumrah', 'India', 850000.00),
(3, 'Rohit Sharma', 'India', 850000.00),
(4, 'Pat Cummins', 'Australia', 920000.00),
(5, 'Travis Head', 'Australia', 780000.00),
(6, 'Kane Williamson', 'New Zealand', 640000.00),
(7, 'Joe Root', 'England', 890000.00),
(8, 'Heinrich Klaasen', 'South Africa', 580000.00),
(9, 'Rashid Khan', 'Afghanistan', 520000.00),
(10, 'Ravindra Jadeja', 'India', 750000.00);

INSERT INTO player_formats (PID, Format, Ranking) VALUES
(1, 'ODI', 2),
(1, 'Test', 8),
(1, 'T20I', 14),
(2, 'Test', 1),
(2, 'ODI', 3),
(2, 'T20I', 2),
(3, 'ODI', 3),
(3, 'Test', 11),
(4, 'Test', 3),
(4, 'ODI', 6),
(5, 'T20I', 1),
(5, 'ODI', 4),
(5, 'Test', 5),
(6, 'Test', 2),
(6, 'ODI', 9),
(7, 'Test', 1),
(7, 'ODI', 12),
(8, 'ODI', 5),
(8, 'T20I', 6),
(9, 'T20I', 1),
(9, 'ODI', 4),
(10, 'Test', 1),
(10, 'ODI', 7);

INSERT INTO player_matches (PID, MID) VALUES
(1, 501), (1, 502), (1, 503), (1, 504), (1, 505), (1, 506),
(2, 501), (2, 502), (2, 503), (2, 504), (2, 506),
(3, 501), (3, 502), (3, 503), (3, 504), (3, 505), (3, 506),
(4, 501), (4, 505),
(5, 501), (5, 505),
(6, 502), (6, 506),
(7, 504),
(8, 503),
(10, 501), (10, 502), (10, 503), (10, 505), (10, 506);

INSERT INTO player_tournaments (PID, TID) VALUES
(1, 101), (1, 102), (1, 103), (1, 104),
(2, 101), (2, 102), (2, 104),
(3, 101), (3, 102), (3, 103), (3, 104),
(4, 101), (4, 103),
(5, 101), (5, 102), (5, 103),
(6, 101), (6, 104),
(7, 101), (7, 102),
(8, 101), (8, 102),
(9, 101), (9, 102), (9, 104),
(10, 101), (10, 102), (10, 103), (10, 104);
