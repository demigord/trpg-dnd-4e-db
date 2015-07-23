package db4e.data;

import updater.Writer;
import java.util.ArrayList;
import java.util.List;
import javafx.collections.ObservableList;
import sheepy.util.ui.ObservableArrayList;

public class Catalog {
   public final ObservableList<Category> categories = new ObservableArrayList<>();

   public synchronized void clear() {
      categories.clear();
   }

   public void addCategories ( String ... names ) {
      List<Category> add = new ArrayList<>( names.length );
      synchronized ( this ) {
         for ( String name : names )
            if ( categories.filtered( e -> e.id.equals( name ) ).isEmpty() )
               add.add( new Category( name ) );
         categories.addAll( add );
      }
   }

   @Override public String toString () {
      if ( categories.size() <= 0 ) return "{}";
      StringBuilder str = new StringBuilder().append( '{' );
      categories.forEach( cat ->
         str.append( cat.id ).append( ':' ).append( cat.entries.size() ).append('/').append( cat.size ) );
      str.setLength( str.length()-1 );
      return str.append( '}' ).toString();
   }

   /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

   private Writer writer;

   public synchronized void setWriter( Writer writer ) {
      if ( this.writer != null )
         this.writer.waitForDone();
      this.writer = writer;
   }
}