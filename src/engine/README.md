# Rules-engine boundary

Pure game rules belong here: deterministic validation and resolution functions that accept typed state and action data, return results, and do not import React, Phaser, browser storage, or Supabase. The server/database operation will be authoritative for live play; the browser may call the rules for presentation or previews but cannot submit trusted outcomes.

The D20 engine, character stats, combat state machine, inventory, progression, quests, and action validation are not implemented in the foundation phase. Add those modules with unit tests before wiring them into gameplay.
