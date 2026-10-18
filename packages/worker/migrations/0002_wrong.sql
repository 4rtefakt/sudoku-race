-- Chiffres signalés faux par la vérification automatique (différents de la solution sans être des doublons) : +30 s chacun.
ALTER TABLE scores ADD COLUMN wrong INTEGER NOT NULL DEFAULT 0;
