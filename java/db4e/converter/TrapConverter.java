package db4e.converter;

import db4e.data.Category;
import db4e.data.Entry;

public class TrapConverter extends LeveledConverter {

   public TrapConverter ( Category category ) {
      super( category );
   }

   @Override protected void correctEntry () {
      if ( entry.meta.length == 4 ) { // Trap
         if ( entry.shortid.equals( "trap1019" ) ) { // Rubble Topple
            swap( "Singe-Use", "Single-Use" );
            meta( 0, "Single-Use Terrain" );
            fix( "typo" );
         }

         String type = meta( 0 );
         String level = meta( LEVEL );
         if ( type.startsWith( "Minion " ) || type.startsWith( "Elite " ) || type.startsWith( "Solo " ) || type.startsWith( "Single-Use ") ) {
            // 33 traps / hazards has mixed type and role. 3 terrain can also be split this way.
            String[] roles = type.split( " ", 2 );
            meta( 1, roles[ 0 ] );
            meta( 0, roles[ 1 ] );
            fix( "wrong meta" );

         } else if ( level.endsWith( "Minion" ) ) {
            // 7 traps in Dungeon 214-215 has level like "8 Minion" and no group role.
            meta( 1, "Minion" );
            meta( LEVEL, level.substring( 0, level.length() - " Minion".length() ) );
            fix( "wrong meta" );
         }
      } else {
         // Terrain; change meta to fit into Trap
         meta( "Terrain", entry.fields[ 0 ], "", entry.fields[ 1 ] );
      }
   }

   @Override protected int sortEntity ( Entry a, Entry b ) {
      int diff = a.meta[ 0 ].toString().compareTo( b.meta[ 0 ].toString() );
      if ( diff != 0 ) return diff;
      return super.sortEntity( a, b );
   }
}