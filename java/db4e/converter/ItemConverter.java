package db4e.converter;

import db4e.data.Category;
import db4e.data.Entry;
import java.util.List;
import java.util.logging.Level;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import sheepy.util.Utils;

public class ItemConverter extends LeveledConverter {

   private static final int CATEGORY = 0;
   private final boolean isGeneric;

   public ItemConverter ( Category category, boolean debug ) {
      super( category, debug ); // Sort by category
      isGeneric = category.id.equals( "Item" );
   }

   @Override public void initialise () {
      super.initialise();
      if ( isGeneric )
         category.meta = new String[]{ "Category", "Type" ,"Level", "Cost", "Rarity", "SourceBook" };
   }

   @Override protected int sortEntity ( Entry a, Entry b ) {
      if ( isGeneric ) {
         int diff = a.meta[ CATEGORY ].toString().compareTo( b.meta[ 0 ].toString() );
         if ( diff != 0 ) return diff;
      }
      return super.sortEntity( a, b );
   }

   private final Matcher regxPowerFrequency = Pattern.compile( "✦\\s*\\(" ).matcher( "" );
   private final Matcher regxWhichIsReproduced = Pattern.compile( " \\([^)]+\\), which is reproduced below(?=.)" ).matcher( "" );
   private final Matcher regxTier = Pattern.compile( "\\b(?:Heroic|Paragon|Epic)\\b" ).matcher( "" );

   @Override protected void convertEntry ( Entry entry ) {
      if ( isGeneric ) {
         String[] fields = entry.fields;
         if ( entry.meta == null ) // Fix level field position before sorting
            entry.meta = new Object[]{ fields[0], "", fields[1], fields[2], fields[3], fields[4] };
      }
      super.convertEntry( entry );
      if ( ! isGeneric )
         entry.shortid = entry.shortid.replace( "item", category.id.toLowerCase() );
      if ( ( ! isGeneric && entry.meta[0].toString().startsWith( "Artifact" ) ) ||
             ( isGeneric && entry.meta[1].equals( "Artifact" ) ) ) {
         regxTier.reset( entry.data ).find();
         entry.meta[ isGeneric ? 2 : 1 ] = regxTier.group();
         return; // Artifacts already have its type set
      }
      // Group Items
      switch ( category.id ) {
         case "Implement" :
            setImplementType( entry ); // Implements's original category may be "Equipment", "Weapon", or "Implement".
            break;
         case "Armor" :
            setArmorType( entry ); // Armor's original category  may be "Armor" or "Arms"
            break;
         case "Weapon" :
            setWeaponType( entry ); // Weapon's original category  may be "Weapon" or "Equipment"
            break;
         default:
            switch ( entry.meta[0].toString() ) {
            case "Arms" :
               entry.meta[1] = "Bracers";
               break;
            case "Armor" :
               setArmorType( entry );
               break;
            case "Wondrous" :
               setWondrousType( entry );
         }
      }
   }
   private final Matcher regxArmorType = Pattern.compile( "<b>(Type|Armor|Arms Slot)(?:</b>: |: </b>)([A-Za-z, ]+)" ).matcher( "" );

   private void setArmorType ( Entry entry ) {
      if ( regxArmorType.reset( entry.data ).find() ) {
         entry.meta[0] = regxArmorType.group( 2 ).trim();
         // Detect "Chain, cloth, hide, leather, plate or scale" and other variants
         if ( entry.meta[0].toString().split( ", " ).length >= 5 ) {
            entry.data = regxArmorType.replaceFirst( "<b>$1</b>: Any" );
            entry.meta[0] = "Any";
            corrections.add( "consistency" );
         }
         int minEnhancement = entry.data.indexOf( "<b>Minimum Enhancement Value</b>: " );
         if ( minEnhancement > 0 ) {
            minEnhancement += "<b>Minimum Enhancement Value</b>: ".length();
            entry.meta[1] = "Min " + entry.data.substring( minEnhancement, minEnhancement + 2 );
         }

      } else
         switch ( entry.shortid ) {
            case "armor49": case "armor50": case "armor51": case "armor52":
               entry.meta[0] = "Barding";
               break;
            default:
               log.log( Level.WARNING, "Armor type not found: {0} {1}", new Object[]{ entry.shortid, entry.name} );
         }
   }

   private final Matcher regxImplementType = Pattern.compile( "<b>Implement: </b>([A-Za-z, ]+)" ).matcher( "" );

   private void setImplementType ( Entry entry ) {
      // Magical implements
      if ( regxImplementType.reset( entry.data ).find() ) {
         entry.meta[0] = regxImplementType.group(1).trim();

      // Superior implements
      } else if ( entry.meta[0].equals( "Weapon" ) ) {
         entry.meta[0] = Utils.ucfirst( entry.name.replaceFirst( "^\\w+ ", "" ) );
         if ( entry.meta[0].equals( "Symbol" ) ) entry.meta[0] = "Holy Symbol";
         entry.meta[1] = "Superior";
         corrections.add( "recategorise" );

      } else if ( entry.meta[0].equals( "Equipment" ) ) {
         entry.meta[0] = entry.name.replaceFirst( " Implement$", "" );
         entry.meta[1] = "Mundane";

      } else
         log.log( Level.WARNING, "Implement group not found: {0} {1}", new Object[]{ entry.shortid, entry.name} );
   }

   private final Matcher regxWeaponType = Pattern.compile( "<b>Weapon: </b>([A-Za-z, ]+)" ).matcher( "" );
   private final Matcher regxWeaponGroup = Pattern.compile( "<br>([A-Za-z ]+?)(?= \\()" ).matcher( "" );

   private void setWeaponType ( Entry entry ) {
      String data = entry.data;
      // Mundane weapons with groups
      if ( data.contains( "<b>Group</b>: " ) ) {
         int groupPos = data.indexOf( "<b>Group</b>: " );
         String region = data.substring( groupPos );
         List<String> grp = Utils.matchAll( regxWeaponGroup, region, 1 );
         if ( grp.isEmpty() )
            log.log( Level.WARNING, "Weapon group not found: {0} {1}", new Object[]{ entry.shortid, entry.name} );
         else
            entry.meta[ 0 ] = String.join( ", ", grp );
         if ( ! entry.meta[2].equals( "" ) || entry.name.endsWith( "secondary end" ) || entry.name.equals( "Shuriken" ) )
            entry.meta[ 1 ] = "Mundane";
         return;
      }
      // Magical weapons
      if ( data.contains( "<b>Weapon: </b>" ) ) {
         regxWeaponType.reset( data ).find();
         entry.meta[0] = regxWeaponType.group( 1 );
         return;
      }
      // Manual assign
      switch ( entry.shortid ) {
         case "weapon3677": // Double scimitar - secondary end
            entry.meta[ 0 ] = "Heavy blade";
            entry.meta[ 1 ] = "Mundane";
            break;
         case "weapon3624": case "weapon3626": case "weapon3634": // Improvised weapons
            entry.meta[ 0 ] = "Improvised";
            entry.meta[ 1 ] = "Mundane";
            break;
         case "weapon176": case "weapon180": case "weapon181": case "weapon219": case "weapon220": case "weapon221": case "weapon222": case "weapon259": // Arrows, magazine, etc.
            entry.meta[ 0 ] = "Ammunition";
            entry.meta[ 1 ] = "Mundane";
            break;
         default:
            log.log( Level.WARNING, "Unknown weapon type: {0} {1}", new Object[]{ entry.shortid, entry.name} );
      }
   }

   private void setWondrousType ( Entry entry ) {
      if ( entry.name.contains( "Tattoo" ) )
         entry.meta[1] = "Tattoo";
   }

   @Override protected void correctEntry ( Entry entry ) {
      if ( ! regxPublished.reset( entry.data ).find() ) {
         entry.data += "<p class=publishedIn>Published in " + entry.meta[ 4 ]  + ".</p>";
         corrections.add( "missing published" );
      }

      if ( entry.data.contains( ", which is reproduced below." ) ) {
         entry.data = regxWhichIsReproduced.reset( entry.data ).replaceFirst( "" );
         corrections.add( "consistency" );
      }

      String data = entry.data;
      switch ( entry.shortid ) {
         case "item467": // Alchemical Failsafe
            entry.data = data.replaceFirst( "Power ✦ </h2>", "Power ✦ At-Will</h2>" );
            corrections.add( "missing power frequency" );
            break;

         case "item1007": // Dantrag's Bracers, first (arm) power is daily, second (feet) power is encounter
            entry.data = data.replaceFirst( "Power ✦ </h2>", "Power ✦ Daily</h2>" );
            entry.data = data.replaceFirst( "Power ✦ </h2>", "Power ✦ Encounter</h2>" );
            corrections.add( "missing power frequency" );
            break;

         case "item1006": // Dancing Weapon
         case "item1261": // Feral Armor
         case "item2451": // Shadowfell Blade
            entry.data = data.replace( "basic melee attack", "melee basic attack" );
            corrections.add( "fix basic attack" );
            break;

         case "item1864": // Mirror of Deception
            entry.data = data.replace( " ✦ (Standard", " ✦ At-Will (Standard" );
            entry.data = data.replace( "alter</p><p class=\"mistat indent\">sound", "alter sound" );
            corrections.add( "formatting" );
            break;

         case "item3328": // Scepter of the Chosen Tyrant
            entry.data = data.replace( "basic ranged attack", "ranged basic attack" );
            corrections.add( "fix basic attack" );
            break;

         case "item3415": // The Fifth Sword of Tyr
            entry.data = data.replace( "Power (Teleportation) ✦ Daily", "Power (Weapon) ✦ Daily" );
            corrections.add( "typo" );
            break;

         default:
            // Add "At-Will" to the ~150 items missing a power frequency.
            // I checked each one and the exceptions are above.
            if ( regxPowerFrequency.reset( data ).find() ) {
               entry.data = regxPowerFrequency.replaceAll( "✦ At-Will (" );
               corrections.add( "missing power frequency" );
            }
      }
   }
}