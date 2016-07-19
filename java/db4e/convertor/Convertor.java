package db4e.convertor;

import db4e.Main;
import db4e.controller.ProgressState;
import db4e.data.Category;
import db4e.data.Entry;
import java.util.TreeSet;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Convert category and entry data for export
 */
public class Convertor {

   private static final Logger log = Main.log;

   protected final Category category;
   private final boolean debug;

   protected Convertor ( Category category, boolean debug ) {
      this.category = category;
      this.debug = debug;
   }

   public static Convertor getConvertor ( Category category, boolean debug ) {
      switch ( category.id ) {
         case "Power":
         case "Ritual":
         case "Monster":
         case "Trap":
         case "Item":
         case "Poison":
         case "Disease":
            return new LeveledConvertor( category, debug );
         default:
            return new Convertor( category, debug );
      }
   }

   public void convert ( ProgressState state ) {
      if ( category.meta == null )
         category.meta = category.fields;
      if ( category.sorted == null )
         category.sorted = new TreeSet<>( this::sortEntity );

      for ( Entry entry : category.entries ) {
         if ( entry.content == null ) throw new IllegalStateException( entry.name + " (" + category.name + ") has no content" );
         convertEntry( entry );
         category.sorted.add( entry ); // addAll yields no speed improvement if source is not sorted
         state.addOne();
      }
   }

   protected int sortEntity ( Entry a, Entry b ) {
      return a.name.compareTo( b.name );
   }

   private final Matcher regxCheckFulltext = Pattern.compile( "<\\w|(?<=\\w)>|&[^D ]" ).matcher( "" );

   protected void convertEntry ( Entry entry ) {
      if ( entry.display_name == null )
         entry.display_name = entry.name.replace( "’", "'" );
      if ( entry.shortid == null )
         entry.shortid = entry.id.replace( ".aspx?id=", "" );
      copyMeta( entry );
      if ( entry.data == null )
         entry.data = normaliseData( entry.content );
      if ( entry.fulltext == null )
         entry.fulltext = textData( entry.data );

      if ( debug ) {
         if ( entry.data.contains( "<img " ) || entry.data.contains( "<a " ) )
            log.log( Level.WARNING, "Unremoved image or link in {0} ({1})", new Object[]{ entry.id, entry.name } );
         if ( regxCheckFulltext.reset( entry.fulltext ).find() )
            log.log( Level.WARNING, "Unremoved html tag in fulltext of {0} ({1})", new Object[]{ entry.id, entry.name } );
      }
   }

   protected void copyMeta ( Entry entry ) {
      if ( entry.meta != null ) return;
      final int length = entry.fields.length;
      entry.meta = new Object[ length ];
      System.arraycopy( entry.fields, 0, entry.meta, 0, length );
   }

   // Products, Magazines of "published in". May be site root (Class Compendium) or empty (associate.93/Earth-Friend)
   //private final Matcher regxSourceLink = Pattern.compile( "<a href=\"(?:http://www\\.wizards\\.com/[^\"]+)?\" target=\"_new\">([^<]+)</a>" ).matcher( "" );
   // Internal entry link, e.g. http://www.wizards.com/dndinsider/compendium/power.aspx?id=2848
   //private final Matcher regxEntryLink = Pattern.compile( "<a href=\"http://www.wizards.com/dndinsider/compendium/[^\"]+\">([^<]+)</a>" ).matcher( "" );
   // Internal search link, e.g. http://ww2.wizards.com/dnd/insider/item.aspx?fid=21&amp;ftype=3 - may also be empty (monster.2508/Darkpact Stalker)
   //private final Matcher regxSearchLink = Pattern.compile( "<a target=\"_new\" href=\"http://ww2.wizards.com/dnd/insider/[^\"]+\">([^<]*)</a>" ).matcher( "" );
   // Combined link pattern
   private final Matcher regxLinks = Pattern.compile( "<a(?: target=\"_new\")? href=\"(?:http://ww[w2].wizards.com/[^\"]*)?\"(?: target=\"_new\")?>([^<]*)</a>" ).matcher( "" );

   protected String normaliseData ( String data ) {
      // Replace images with character. Every image really appears in the compendium.
      data = data.replace( "<img src=\"images/bullet.gif\" alt=\"\">", "✦" ); // Four pointed star, 11x11, most common image at 100k hits
      data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/x.gif\">", "✦" ); // Four pointed star, 7x10, second most common image at 40k hits
      if ( data.contains( "<img " ) ) { // Most likely monsters
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/S2.gif\">", "(⚔)" ); // Basic melee, 14x14
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/S3.gif\">", "(➶)" ); // Basic ranged, 14x14
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/Z1.gif\">" , "ᗕ" ); // Blast, 20x20, for 10 monsters
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/Z1a.gif\">", "ᗕ" ); // Blast, 14x14
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/Z2a.gif\">", "⚔" ); // Melee, 14x14
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/Z3a.gif\">", "➶" ); // Ranged, 14x14
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/Z4.gif\">",  "✻" ); // Area, 20x20
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/Z4a.gif\">", "✻" ); // Area, 14x14
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/aura.png\" align=\"top\">", "☼" ); // Aura, 14x14
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/aura.png\">", "☼" ); // Aura, 14x14, ~1000?
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/1a.gif\">", "⚀" ); // Dice 1, 12x12, honors go to monster.4611/"Rort, Goblin Tomeripper"
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/2a.gif\">", "⚁" ); // Dice 2, 12x12, 4 monsters got this
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/3a.gif\">", "⚂" ); // Dice 3, 12x12, ~30
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/4a.gif\">", "⚃" ); // Dice 4, 12x12, ~560
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/5a.gif\">", "⚄" ); // Dice 5, 12x12, ~2100
         data = data.replace( "<img src=\"http://www.wizards.com/dnd/images/symbol/6a.gif\">", "⚅" ); // Dice 6, 12x12, ~2500
      }
      // Convert nbsp to character
      data = data.replace( "&nbsp;", "\u00A0" );
      data = regxSpaces.reset( data ).replaceAll( " " );
      // Convert ’ to ' so that people can actually search for it
      data = data.replace( "’", "'" );
      // Convert some rare line breaks
      if ( data.indexOf( '\n' ) >= 0 ) {
         data = data.replace( "\n,", "," );
         data = data.replace( "\n.", "." );
         data = data.replace( ".\n", "." );
      }

      // Remove links
      //data = regxSourceLink.reset( data ).replaceAll( "$1" );
      //data = regxEntryLink .reset( data ).replaceAll( "$1" );
      //data = regxSearchLink.reset( data ).replaceAll( "$1" );
      data = regxLinks.reset( data ).replaceAll( "$1" );

      return data.trim();
   }

   private final Matcher regxHtmlTag = Pattern.compile( "</?\\w+[^>]*>" ).matcher( "" );
   private final Matcher regxSpaces  = Pattern.compile( " +" ).matcher( " " );

   /**
    * Convert HTML data into full text data for full text search.
    *
    * @param data Data to strip
    * @return Text data
    */
   protected String textData ( String data ) {
      // Strip HTML tags
      data = data.replace( '\u00A0', ' ' );
      data = regxHtmlTag.reset( data ).replaceAll( " " );
      data = regxSpaces.reset( data ).replaceAll( " " );
      // HTML unescape. Compendium has relatively few escapes.
      data = data.replace( "&amp;", "&" );
      data = data.replace( "&gt;", ">" ); // glossary.433/"Weapons and Size"
      return data.trim();
   }
}