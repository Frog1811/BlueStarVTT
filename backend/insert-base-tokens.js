// Quick script to insert base tokens into database
const mysql = require('mysql2/promise');

async function insertBaseTokens() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'BlueStar6321',
    database: 'DNDTool'
  });

  console.log('Connected to database');

  // JOCAT tokens (the ones you're trying to drag)
  const jocatTokens = [
    ['jocat-Aracockra.png', 'Aracockra', '/assets/JOCAT/Aracockra.png'],
    ['jocat-Bugbear.png', 'Bugbear', '/assets/JOCAT/Bugbear.png'],
    ['jocat-Dragonborn B.png', 'Dragonborn B', '/assets/JOCAT/Dragonborn B.png'],
    ['jocat-Dragonborn BL.png', 'Dragonborn BL', '/assets/JOCAT/Dragonborn BL.png'],
    ['jocat-Dragonborn Brs.png', 'Dragonborn Brs', '/assets/JOCAT/Dragonborn Brs.png'],
    ['jocat-Dragonborn Brz.png', 'Dragonborn Brz', '/assets/JOCAT/Dragonborn Brz.png'],
    ['jocat-Dragonborn C.png', 'Dragonborn C', '/assets/JOCAT/Dragonborn C.png'],
    ['jocat-Dragonborn G.png', 'Dragonborn G', '/assets/JOCAT/Dragonborn G.png'],
    ['jocat-Dragonborn Gld.png', 'Dragonborn Gld', '/assets/JOCAT/Dragonborn Gld.png'],
    ['jocat-Dragonborn R.png', 'Dragonborn R', '/assets/JOCAT/Dragonborn R.png'],
    ['jocat-Dragonborn Slv.png', 'Dragonborn Slv', '/assets/JOCAT/Dragonborn Slv.png'],
    ['jocat-Dragonborn W.png', 'Dragonborn W', '/assets/JOCAT/Dragonborn W.png'],
    ['jocat-Drow.png', 'Drow', '/assets/JOCAT/Drow.png'],
    ['jocat-Dwarf.png', 'Dwarf', '/assets/JOCAT/Dwarf.png'],
    ['jocat-Elf.png', 'Elf', '/assets/JOCAT/Elf.png'],
    ['jocat-Firbolg.png', 'Firbolg', '/assets/JOCAT/Firbolg.png'],
    ['jocat-Genasi_Air.png', 'Genasi Air', '/assets/JOCAT/Genasi_Air.png'],
    ['jocat-Genasi_Earth.png', 'Genasi Earth', '/assets/JOCAT/Genasi_Earth.png'],
    ['jocat-Genasi_Fire.png', 'Genasi Fire', '/assets/JOCAT/Genasi_Fire.png'],
    ['jocat-Genasi_Water.png', 'Genasi Water', '/assets/JOCAT/Genasi_Water.png'],
    ['jocat-Gnome.png', 'Gnome', '/assets/JOCAT/Gnome.png'],
    ['jocat-Goblin.png', 'Goblin', '/assets/JOCAT/Goblin.png'],
    ['jocat-Halfelf.png', 'Halfelf', '/assets/JOCAT/Halfelf.png'],
    ['jocat-Halfling.png', 'Halfling', '/assets/JOCAT/Halfling.png'],
    ['jocat-Halforc.png', 'Halforc', '/assets/JOCAT/Halforc.png'],
    ['jocat-Hobgoblin.png', 'Hobgoblin', '/assets/JOCAT/Hobgoblin.png'],
    ['jocat-Human.png', 'Human', '/assets/JOCAT/Human.png'],
    ['jocat-Kenku.png', 'Kenku', '/assets/JOCAT/Kenku.png'],
    ['jocat-Kobold.png', 'Kobold', '/assets/JOCAT/Kobold.png'],
    ['jocat-Ogre.png', 'Ogre', '/assets/JOCAT/Ogre.png'],
    ['jocat-Orc.png', 'Orc', '/assets/JOCAT/Orc.png'],
    ['jocat-Tabaxi.png', 'Tabaxi', '/assets/JOCAT/Tabaxi.png'],
    ['jocat-Tiefling.png', 'Tiefling', '/assets/JOCAT/Tiefling.png'],
    ['jocat-Warforged.png', 'Warforged', '/assets/JOCAT/Warforged.png']
  ];

  let inserted = 0;
  for (const [id, name, path] of jocatTokens) {
    try {
      await connection.execute(
        'INSERT IGNORE INTO tokens (id, campaign_id, token_folder_id, name, image_path, is_base_token) VALUES (?, NULL, NULL, ?, ?, 1)',
        [id, name, path]
      );
      inserted++;
      console.log(`✓ Inserted: ${name}`);
    } catch (error) {
      console.error(`✗ Failed: ${name}`, error.message);
    }
  }

  // Icon tokens
  const iconTokens = [
    ['Aberration', 'Aberration', '/assets/Icons/Aberration.png'],
    ['Artificer', 'Artificer', '/assets/Icons/Artificer.png'],
    ['Barbarian', 'Barbarian', '/assets/Icons/Barbarian.png'],
    ['Bard', 'Bard', '/assets/Icons/Bard.png'],
    ['Beast', 'Beast', '/assets/Icons/Beast.png'],
    ['Cleric', 'Cleric', '/assets/Icons/Cleric.png'],
    ['Dragon', 'Dragon', '/assets/Icons/Dragon.png'],
    ['Druid', 'Druid', '/assets/Icons/Druid.png'],
    ['Fighter', 'Fighter', '/assets/Icons/Fighter.png'],
    ['Monk', 'Monk', '/assets/Icons/Monk.png'],
    ['Paladin', 'Paladin', '/assets/Icons/Paladin.png'],
    ['Ranger', 'Ranger', '/assets/Icons/Ranger.png'],
    ['Rogue', 'Rogue', '/assets/Icons/Rogue.png'],
    ['Sorcerer', 'Sorcerer', '/assets/Icons/Sorcerer.png'],
    ['Warlock', 'Warlock', '/assets/Icons/Warlock.png'],
    ['Wizard', 'Wizard', '/assets/Icons/Wizard.png']
  ];

  for (const [id, name, path] of iconTokens) {
    try {
      await connection.execute(
        'INSERT IGNORE INTO tokens (id, campaign_id, token_folder_id, name, image_path, is_base_token) VALUES (?, NULL, NULL, ?, ?, 1)',
        [id, name, path]
      );
      inserted++;
      console.log(`✓ Inserted: ${name}`);
    } catch (error) {
      console.error(`✗ Failed: ${name}`, error.message);
    }
  }

  console.log(`\n✅ SUCCESS! Inserted ${inserted} base tokens!`);

  // Verify
  const [rows] = await connection.execute('SELECT COUNT(*) as count FROM tokens WHERE is_base_token = 1');
  console.log(`\nTotal base tokens in database: ${rows[0].count}`);

  await connection.end();
}

insertBaseTokens().catch(console.error);

