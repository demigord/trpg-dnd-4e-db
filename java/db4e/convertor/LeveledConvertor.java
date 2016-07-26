package db4e.convertor;

import db4e.data.Category;
import db4e.data.Entry;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

class LeveledConvertor extends Convertor {

   private int LEVEL = -1;

   protected LeveledConvertor ( Category category, boolean debug ) {
      super( category, debug );
   }

   @Override public void initialise () {
      LEVEL = metaIndex( "Level" );
      // if ( LEVEL < 0 ) throw new IllegalStateException( "Level field not in " + category.name );
   }

   static Map<String, String> levelText = new HashMap<>(); // Cache level text
   static Map<Object, Float> levelNumber = new HashMap<>();

   @Override protected void convertEntry ( Entry entry ) {
      super.convertEntry( entry );
      if ( LEVEL < 0 ) return;
      String level = entry.meta[ LEVEL ].toString();
      if ( levelText.containsKey( level ) ) {
         entry.meta[ LEVEL ] = level = levelText.get( level );
      } else {
         levelText.put( level, level );
         levelNumber.put( level, parseLevel( level ) );
      }
   }

   private float parseLevel ( Object value ) {
      if ( value == null ) return -1;
      String level = value.toString();
      try {
         return Integer.valueOf( level );
      } catch ( NumberFormatException ex1 ) {
         if ( level.endsWith( "+" ) ) level = level.substring( 0, level.length() - 1 );
         try {
            return Integer.valueOf( level );
         } catch ( NumberFormatException ex2 ) {
         }
      }
      switch ( value.toString() ) {
         case "-": // Rubble Topple, Brazier Topple, Donjon's Cave-in.
         case "":
            return 0f;
         case "Heroic":
            return 10.5f;
         case "Paragon":
            return 20.5f;
         case "Epic":
            return 30.5f;
         default:
            // variable / Variable / Varies / (Level) / Party's Level
            return 40.5f;
      }
   }

   @Override protected int sortEntity ( Entry a, Entry b ) {
      if ( LEVEL >= 0 ) {
         float level = levelNumber.get( a.meta[ LEVEL ] ) - levelNumber.get( b.meta[ LEVEL ] );
         if ( level < 0 )
            return -1;
         else if ( level > 0 )
            return 1;
      }
      return super.sortEntity( a, b );
   }

   @Override protected String correctEntry ( Entry entry ) {
      switch ( category.id ) {
      case  "Poison":
         int orig_length = entry.data.length();
         entry.data = entry.data.replace( "<p>Published in", "<p class=publishedIn>Published in" );

         switch ( entry.shortid ) {
         case "poison19": // Granny's Grief
            entry.data = entry.data.replace( ">Published in .<", ">Published in Dungeon Magazine 211.<" );
            return "missing published";
         }
         return entry.data.length() == orig_length ? null : "formatting";

      case "Trap":
         // 7 traps in Dungeon 214-215 has level like "8 Minion" and no group role.
         String level = entry.meta[ LEVEL ].toString();
         if ( level.endsWith( "Minion" ) ) {
            entry.meta[ Arrays.asList( category.meta ).indexOf( "GroupRole" ) ] = "Minion";
            entry.meta[ LEVEL ] = level.substring( 0, level.length() - " Minion".length() );
            return "formatting";
         }
         return null;

      case "Monster":
         switch ( entry.shortid ) {

         case "monster2248": // Cambion Stalwart
            entry.data = entry.data.replace( "bit points", "hit points" );
            return "typo";

         case "monster3222": // Veln
         case "monster3931": // Demon Furor
            entry.data = entry.data.replace( "basic melee or basic ranged attack", "melee or ranged basic attack" );
            return "basic attack correction";

         default:
            if ( entry.data.contains( "basic melee attack") ) {
               entry.data = entry.data.replace( "basic melee attack", "melee basic attack" );
               return "basic attack correction";
            }

         } return null;
      }
      return null;
   }
}