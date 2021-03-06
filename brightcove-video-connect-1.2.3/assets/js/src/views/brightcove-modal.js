var BrightcoveModalView = BrightcoveView.extend(
	{
		tagName :   'div',
		className : 'media-modal brightcove',
		template :  wp.template( 'brightcove-media-modal' ),

		events : {
			'click .brightcove.media-menu-item' :     'changeTab',
			'click .brightcove.media-button-insert' : 'insertIntoPost',
			'click .brightcove.media-modal-icon' :   'closeModal'
		},

		initialize : function ( options ) {
			this.model                  = new BrightcoveModalModel( {tab : options.tab} );
			this.brightcoveMediaManager = new BrightcoveMediaManagerView( this.model.getMediaManagerSettings() );
			this.registerSubview( this.brightcoveMediaManager );
			this.listenTo( wpbc.broadcast, 'toggle:insertButton', function ( state ) {
				this.toggleInsertButton( state );
			} );
			this.listenTo( wpbc.broadcast, 'close:modal', this.closeModal );
		},

		insertIntoPost : function ( evnt ) {
			// Exit if the 'button' is disabled.
			if ( $( evnt.currentTarget ).hasClass( 'disabled' ) ) {
				evnt.preventDefault();
				return;
			}

			// Make the selected player available to the shortcode
			wpbc.selectedPlayer = $( 'input[name="video-player-field"]:checked' ).val();

			// Media Details will trigger the insertion since it's always active and contains
			// the model we're inserting
			wpbc.broadcast.trigger( 'insert:shortcode' );

		},

		toggleInsertButton : function ( state ) {
			var button = this.$el.find( '.brightcove.media-button' );
			if ( 'enabled' === state ) {
				button.removeAttr( 'disabled' );
			} else if ( 'disabled' === state ) {
				button.attr( 'disabled', 'disabled' );
			} else if ( undefined !== button.attr( 'disabled' ) ) {
				button.removeAttr( 'disabled' );
			} else {
				button.attr( 'disabled', 'disabled' );
			}
		},

		changeTab : function ( event ) {
			if ( $( event.target ).hasClass( 'active' ) ) {
				return; // Clicking the already active tab
			}
			$( event.target ).addClass( 'active' );
			var tab  = _.without( event.target.classList, 'media-menu-item', 'brightcove' )[0];
			var tabs = ['videos', 'upload', 'playlists'];
			_.each( _.without( tabs, tab ), function ( otherTab ) {
				$( '.brightcove.media-menu-item.' + otherTab ).removeClass( 'active' );
			} );

			if ( _.contains( tabs, tab ) ) {
				this.model.set( 'tab', tab );
				wpbc.broadcast.trigger( 'spinner:off' );
				wpbc.broadcast.trigger( 'tabChange', this.model.getMediaManagerSettings() );
			}

		},

		closeModal : function ( evnt ) {

			// If we are in the editVideo mode, switch back to the video view.
			if ( 'editVideo' === wpbc.modal.brightcoveMediaManager.model.get('mode') ) {
				wpbc.broadcast.trigger( 'start:gridview' );
			}

			// Exit if the container button is disabled.
			if ( ! _.isUndefined( evnt ) && $( evnt.currentTarget ).parent().hasClass( 'disabled' ) ) {
				return;
			}
			this.$el.hide();
			$( 'body' ).removeClass( 'modal-open' );
		},

		message : function ( message ) {
			var messageContainer = this.$el.find( '.brightcove-message' );

		},

		render : function ( options ) {
			this.$el.html( this.template( options ) );

			this.brightcoveMediaManager.render();
			this.brightcoveMediaManager.$el.appendTo( this.$el.find( '.media-frame-content' ) );
		}

	}
);

