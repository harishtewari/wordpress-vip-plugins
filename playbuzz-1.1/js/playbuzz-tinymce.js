(function () {

	tinymce.PluginManager.add(
		'playbuzz', function (editor, url) {

			var search = new playbuzz_search();
			var apiBaseUrl = document.location.protocol + "//rest-api-v2.playbuzz.com/v2/items";
			// any part of the regex is important because tinymce can change the content of any div
			var playbuzz_embed_code_pattern = /<div class="playbuzz"[^<]*data-id((?!<\/div>).)*<\/div>/g;
			var playbuzz_javascript_pattern = /<script>((?!<\/script>).)*embed\.playbuzz\.com((?!<\/script>).)*<\/script>[\s]*(<br \/>)?/g;
			var encoded_playbuzz_javascript_pattern = /<img.*embed\.playbuzz\.com((?!\/>).)*\/>*/g;
			var pb_shortcode = /\[playbuzz-item([^\]]*)\]/g;

			// Playbuzz item popup - create popup structure
			function playbuzz_item_popup_structure(settings_to_use, item_url, info, shares, comments, recommend, margin_top, width, height, links, tags, itemId, format) {

				// Popup Components
				(jQuery)( "<form></form>" ).attr( "id", "playbuzz_item_form" ).attr( "name", "item" ).appendTo( "#playbuzz_popup" );
				(jQuery)( "<div></div>" ).attr( "id", "playbuzz_item_header" ).appendTo( "#playbuzz_item_form" );
				(jQuery)( "<div></div>" ).attr( "id", "playbuzz_item_body" ).appendTo( "#playbuzz_item_form" );
				(jQuery)( "<div></div>" ).attr( "id", "playbuzz_item_update" ).appendTo( "#playbuzz_item_form" );

				// Header
				(jQuery)( "<div></div>" ).attr( "id", "playbuzz_popup_close" ).appendTo( "#playbuzz_item_header" ).click(
					function () {
						(jQuery)( ".playbuzz_popup_overlay_container" ).remove();
					}
				);

				(jQuery)( "<p></p>" ).addClass( "playbuzz_item_header_text" ).appendTo( "#playbuzz_item_header" ).text( translation.playbuzz_item_settings );

				// Footer
				(jQuery)( "<input>" ).attr( "id", "playbuzz_item_settings_format" ).attr( "type", "hidden" ).attr( "value", format ).appendTo( "#playbuzz_item_update" );
				(jQuery)( "<input>" ).attr( "id", "playbuzz_item_settings_url" ).attr( "type", "hidden" ).attr( "value", item_url ).appendTo( "#playbuzz_item_update" );
				(jQuery)( "<input>" ).attr( "id", "playbuzz_item_settings_id" ).attr( "type", "hidden" ).attr( "value", itemId ).appendTo( "#playbuzz_item_update" );
				(jQuery)( "<input>" ).attr( "id", "playbuzz_item_settings_width" ).attr( "type", "hidden" ).attr( "value", width ).appendTo( "#playbuzz_item_update" );
				(jQuery)( "<input>" ).attr( "id", "playbuzz_item_settings_height" ).attr( "type", "hidden" ).attr( "value", height ).appendTo( "#playbuzz_item_update" );
				(jQuery)( "<input>" ).attr( "id", "playbuzz_item_settings_links" ).attr( "type", "hidden" ).attr( "value", links ).appendTo( "#playbuzz_item_update" );
				(jQuery)( "<input>" ).attr( "id", "playbuzz_item_settings_tags" ).attr( "type", "hidden" ).attr( "value", tags ).appendTo( "#playbuzz_item_update" );
				(jQuery)( "<div></div>" ).addClass( "playbuzz_item_cancel_button" ).appendTo( "#playbuzz_item_update" ).text( translation.cancel ).click(
					function () {
						(jQuery)( '.playbuzz_popup_overlay_container' ).remove();
					}
				);
				(jQuery)( "<div></div>" ).addClass( "playbuzz_item_update_button" ).appendTo( "#playbuzz_item_update" ).text( translation.update_item );

				// Content
				(jQuery)( "<div></div>" ).attr( "id", "playbuzz_item_preview" ).appendTo( "#playbuzz_item_body" );
				(jQuery)( "<div></div>" ).attr( "id", "playbuzz_item_settings" ).appendTo( "#playbuzz_item_body" );
				(jQuery)( "<p></p>" ).addClass( "playbuzz_item_settings_title" ).appendTo( "#playbuzz_item_settings" ).text( translation.item_settings ).append( (jQuery)( "<span></span>" ).text( translation.embedded_item_appearance ) );
				(jQuery)( "<div></div>" ).addClass( "playbuzz_item_settings_select" ).appendTo( "#playbuzz_item_settings" );
				(jQuery)( "<input>" ).attr( "id", "playbuzz_item_settings_default" ).attr( "name", "playbuzz_item_settings" ).attr( "type", "radio" ).attr( "value", "default" ).appendTo( ".playbuzz_item_settings_select" );
				(jQuery)( "<label></label>" ).attr( "for", "playbuzz_item_settings_default" ).appendTo( ".playbuzz_item_settings_select" ).text( translation.use_site_default_settings ).append( (jQuery)( "<a></a>" ).attr( "target", "_blank" ).attr( "href", "options-general.php?page=playbuzz&tab=embed" ).text( translation.configure_default_settings ) );
				(jQuery)( "<br>" ).appendTo( ".playbuzz_item_settings_select" );
				(jQuery)( "<input>" ).attr( "id", "playbuzz_item_settings_custom" ).attr( "name", "playbuzz_item_settings" ).attr( "type", "radio" ).attr( "value", "custom" ).appendTo( ".playbuzz_item_settings_select" );
				(jQuery)( "<label></label>" ).attr( "for", "playbuzz_item_settings_custom" ).appendTo( ".playbuzz_item_settings_select" ).text( translation.custom );
				(jQuery)( "<br>" ).appendTo( ".playbuzz_item_settings_select" );

				(jQuery)( "<div></div>" ).addClass( "settings_half settings_half1" ).appendTo( ".playbuzz_item_settings_select" );
				(jQuery)( "<input>" ).attr( "id", "playbuzz_item_settings_info" ).attr( "type", "checkbox" ).appendTo( ".settings_half1" );
				(jQuery)( "<label></label>" ).attr( "for", "playbuzz_item_settings_info" ).appendTo( ".settings_half1" ).text( translation.display_item_information );
				(jQuery)( "<div></div>" ).addClass( "description" ).appendTo( ".settings_half1" ).text( translation.show_item_thumbnail_name_description_creator );
				(jQuery)( "<input>" ).attr( "id", "playbuzz_item_settings_shares" ).attr( "type", "checkbox" ).appendTo( ".settings_half1" );
				(jQuery)( "<label></label>" ).attr( "for", "playbuzz_item_settings_shares" ).appendTo( ".settings_half1" ).text( translation.display_share_buttons );
				(jQuery)( "<div></div>" ).addClass( "description" ).appendTo( ".settings_half1" ).text( translation.show_share_buttons_with_links_to_your_site );

				(jQuery)( "<div></div>" ).addClass( "settings_half settings_half2" ).appendTo( ".playbuzz_item_settings_select" );
				(jQuery)( "<input>" ).attr( "id", "playbuzz_item_settings_comments" ).attr( "type", "checkbox" ).appendTo( ".settings_half2" );
				(jQuery)( "<label></label>" ).attr( "for", "playbuzz_item_settings_comments" ).appendTo( ".settings_half2" ).text( translation.display_facebook_comments );
				(jQuery)( "<div></div>" ).addClass( "description" ).appendTo( ".settings_half2" ).text( translation.show_facebook_comments_in_your_items );
				(jQuery)( "<input>" ).attr( "id", "playbuzz_item_settings_margin" ).attr( "type", "checkbox" ).appendTo( ".settings_half2" );
				(jQuery)( "<label></label>" ).attr( "for", "playbuzz_item_settings_margin" ).appendTo( ".settings_half2" ).text( translation.site_has_fixed_sticky_top_header );
				(jQuery)( "<div></div>" ).addClass( "playbuzz_item_settings_margin_top_text" ).appendTo( ".settings_half2" ).text( translation.height + " " );
				(jQuery)( "<input>" ).attr( "id", "playbuzz_item_settings_margin_top" ).attr( "type", "input" ).attr( "value", margin_top ).appendTo( ".playbuzz_item_settings_margin_top_text" ).text( translation.px );
				(jQuery)( "<div></div>" ).addClass( "description" ).appendTo( ".settings_half2" ).text( translation.use_this_if_your_website_has_top_header_thats_always_visible_even_while_scrolling_down );

				// Select Settings
				if (settings_to_use == "default") {
					(jQuery)( "#playbuzz_item_settings_default" ).prop( 'checked', true );
				}

				if (settings_to_use == "custom") {
					(jQuery)( "#playbuzz_item_settings_custom" ).prop( 'checked', true );
				}

				if ((typeof info != 'undefined') && (info.length) && ((info == true) || (info > 0) || (info.toLowerCase() == "true") || (info.toLowerCase() == "on") || (info == "1"))) {
					(jQuery)( "#playbuzz_item_settings_info" ).prop( 'checked', true );
				}

				if ((typeof shares != 'undefined') && (shares.length) && ((shares == true) || (shares > 0) || (shares.toLowerCase() == "true") || (shares.toLowerCase() == "on") || (shares == "1"))) {
					(jQuery)( "#playbuzz_item_settings_shares" ).prop( 'checked', true );
				}

				if ((typeof recommend != 'undefined') && (recommend.length) && ((recommend == true) || (recommend > 0) || (recommend.toLowerCase() == "true") || (recommend.toLowerCase() == "on") || (recommend == "1"))) {
					(jQuery)( "#playbuzz_item_settings_recommend" ).prop( 'checked', true );
				}

				if ((typeof comments != 'undefined') && (comments.length) && ((comments == true) || (comments > 0) || (comments.toLowerCase() == "true") || (comments.toLowerCase() == "on") || (comments == "1"))) {
					(jQuery)( "#playbuzz_item_settings_comments" ).prop( 'checked', true );
				}

				if ((typeof margin_top != 'undefined') && (margin_top.length) && ((margin_top == true) || (margin_top > 0) || (margin_top.toLowerCase() == "true") || (margin_top.toLowerCase() == "on") || (margin_top == "1"))) {
					(jQuery)( "#playbuzz_item_settings_margin_top" ).prop( 'checked', true );
				}

			}

			// Get attribute from pattern
			function get_attr(pattern, attr) {

				n = new RegExp( attr + '=\"([^\"]+)\"', 'g' ).exec( pattern );
				return n ? window.decodeURIComponent( n[1] ) : '';

			}

			// Return formatted date
			function item_date(published_at) {

				var months = [
						translation.jan,
						translation.feb,
						translation.mar,
						translation.apr,
						translation.may,
						translation.jun,
						translation.jul,
						translation.aug,
						translation.sep,
						translation.oct,
						translation.nov,
						translation.dec
					],
					publish_date = new Date( published_at ),
					published = months[publish_date.getMonth()] + ' ' + publish_date.getDate() + ', ' + publish_date.getFullYear();

				return published;

			}

			// Return item type
			function playbuzz_item_type(type) {

				switch (type && type.toLowerCase()) {
					case "personality-quiz"    :
					case "testyourself"    :
						name = translation.personality_quiz;
						break;
					case "story"            :
						name = translation.story;
						break;
					case "snap-article"     :
						name = translation.story;
						break;
					case "list"            :
						name = translation.list;
						break;
					case "trivia"            :
					case "multiplechoice"    :
						name = translation.trivia;
						break;
					case "poll"                :
					case "playbuzzpoll"    :
						name = translation.poll;
						break;
					case "ranked-list"      :
					case "ranklist"        :
						name = translation.ranked_list;
						break;
					case "gallery-quiz"        :
					case "gallery"        :
						name = translation.gallery_quiz;
						break;
					case "flip-cards"        :
					case "reveal"        :
						name = translation.flip_cards;
						break;
					case "swiper"            :
						name = translation.swiper;
						break;
					case "countdown"        :
						name = translation.countdown;
						break;
					case "video-snaps"        :
					case "videosnaps"        :
						name = translation.video_snaps;
						break;
					case "convo"            :
						name = translation.convo;
						break;
					default                :
						name = "";
						break;
				}
				return name;

			}

			// Return random generated id for connecting between short-codes and visual placeholders in wordpress
			function generate_id() {
				return Math.round( Math.random() * 1000000 );
			}

			function set_playbuzz_item_shortcode(id, short_code) {
				var content = editor.getContent();
				var shortcodeRegex = new RegExp( '\\[([^\\[\\]]*)wp\\-pb\\-id="' + id + '"[^\\]]*\\]' );
				var newContent = content.replace( shortcodeRegex, short_code );
				editor.setContent( newContent );
			}

			function delete_playbuzz_item_shortcode(id) {
				set_playbuzz_item_shortcode( id, '' );
			}

			var playbuzz_place_holder_pattern = /<div class="wp_playbuzz_container"(.*?)"wp_playbuzz_container_end">((?!<\/div>).)*<\/div>((?!<\/div>).)*<\/div>([\s]*<p>[\s]<\/p>)?/g;

			function ensure_short_code_has_id(match) {
				return match.indexOf( 'wp-pb-id' ) >= 0 ? match : match.replace( ']', ' wp-pb-id="' + generate_id() + '"]' )
			}

			editor.addCommand(
				'search_playbuzz_items', function () {
					search.display( playbuzz_generate_shortcode );

					function playbuzz_generate_shortcode(itemId) {
						if (tinyMCE && tinyMCE.activeEditor) {
							tinymce.activeEditor.execCommand( 'mceInsertContent', false, '[playbuzz-item item="' + itemId + '" wp-pb-id="' + generate_id() + '"]<br>' );
						}
					}
				}
			);

			// Add playbuzz button to tinyMCE visual editor
			editor.addButton(
				'playbuzz', {
					icon: 'playbuzz',
					tooltip: 'Playbuzz',
					onclick: function () {
						editor.execCommand( 'search_playbuzz_items' );
					}
				}
			);

			// Replace the embed-code to shortcode with an item info box
			// And Replace shortcode to placeholder
			editor.on(
				'BeforeSetContent', function (event) {
					event.content = event.content
						.replace( playbuzz_embed_code_pattern, playbuzz_embedcode_to_short_code )
						.replace( encoded_playbuzz_javascript_pattern, '' )
						.replace( pb_shortcode, ensure_short_code_has_id )
						.replace( pb_shortcode, short_code_to_placeholder );
				}
			);

            function createContainer(id, encodedShortcodeAttributes) {

                var playbuzz_info = document.createElement( 'div' );
                playbuzz_info.setAttribute('id', "playbuzz_info_" + id);
                playbuzz_info.className = "wp_playbuzz_info";

                var playbuzz_image = document.createElement( 'div' );
                playbuzz_image.setAttribute('id', "playbuzz_image_" + id);
                playbuzz_image.className = "wp_playbuzz_image";

                var playbuzz_image_placeholder = document.createElement( 'img' );
                playbuzz_image_placeholder.setAttribute('data-mce-resize','false');
                playbuzz_image_placeholder.setAttribute('data-mce-placeholder','1');
                playbuzz_image_placeholder.setAttribute('id', "playbuzz_placeholder_" + id);
                playbuzz_image_placeholder.setAttribute('src', url + "/../img/playbuzz-placeholder.png");
                playbuzz_image_placeholder.className = "mceItem wp_playbuzz_placeholder";

                playbuzz_image.appendChild(playbuzz_image_placeholder);

                var playbuzz_embed = document.createElement( 'div' );
                playbuzz_embed.setAttribute('id', "playbuzz_embed_" + id);
                playbuzz_embed.className = "wp_playbuzz_embed";

                var embed_text = document.createTextNode( translation.your_item_will_be_embedded_here );
                playbuzz_embed.appendChild(embed_text);

                var playbuzz_buttons = document.createElement( 'div' );
                playbuzz_buttons.setAttribute('id', "playbuzz_overlay_" + id);
                playbuzz_buttons.setAttribute('data-playbuzz-attr', encodedShortcodeAttributes);
                playbuzz_buttons.className = "wp_playbuzz_buttons";

                var playbuzz_delete = document.createElement( 'div' );
                playbuzz_delete.setAttribute('id', "playbuzz_overlay_close_" + id);
                playbuzz_delete.className = "wp_playbuzz_delete";

                var playbuzz_edit = document.createElement( 'div' );
                playbuzz_edit.setAttribute('id', "playbuzz_overlay_edit_" + id);
                playbuzz_edit.setAttribute('data-playbuzz-attr', encodedShortcodeAttributes);
                playbuzz_edit.className = "wp_playbuzz_edit";

                var container = document.createElement( 'div' );
                container.appendChild(playbuzz_info);
                container.appendChild(playbuzz_image);
                container.appendChild(playbuzz_embed);
                container.appendChild(playbuzz_buttons);
                container.appendChild(playbuzz_delete);
                container.appendChild(playbuzz_edit);

                var container_wrapper = document.createElement( 'div' );
                container_wrapper.setAttribute('data-wp-pb-id', id);
                container_wrapper.setAttribute('contenteditable', 'false');
                container_wrapper.className = "wp_playbuzz_container";

                var container_end = document.createElement( 'div' );
                container_end.className = "wp_playbuzz_container_end";

                container_wrapper.appendChild(container);
                container_wrapper.appendChild(container_end);

                // container_end use is for regex matching
                return container_wrapper.outerHTML;
            }

			function short_code_to_placeholder(all, attr) {

				// Encode all the shortcode attributes, to be stored in <div data-playbuzz-attr="...">
				var encodedShortcodeAttributes = window.encodeURIComponent( attr );

				// Extract itemPath from itemUrl -  "http://playbuzz.com/{creatorName}/{gameName}
				var itemId = get_attr( decodeURIComponent( encodedShortcodeAttributes ), 'item' ),
					itemUrl = get_attr( decodeURIComponent( encodedShortcodeAttributes ), 'url' ),
					itemPath = itemUrl.split( "playbuzz.com/" ).pop(),
					itemPathArray = itemPath.split( "/" ),
					creatorName = itemPathArray[0],
					gameName = itemPathArray[1];

				var data = {
					size: 1,
					moderation: "none"
				};

				if (itemUrl) {
					data.alias = creatorName + "/" + gameName;
				} else {
					data.id = itemId;
				}

				// Set random image id
				var id = get_attr( decodeURIComponent( encodedShortcodeAttributes ), 'wp-pb-id' );

				// Get Item info
				(jQuery).ajax(
					{
						url: apiBaseUrl,
						type: "get",
						dataType: "json",
						data: data,
						success: function (data) {

							// Data output
							if (data.payload.totalItems > 0) {

								var item = data.payload.items[0];

								// Set item image
								(jQuery)( tinyMCE.activeEditor.dom.doc.body )
									.find( "#playbuzz_placeholder_" + id )
									.attr( "src", item.imageLarge );

								// Set item info
								(jQuery)( tinyMCE.activeEditor.dom.doc.body )
									.find( "#playbuzz_info_" + id )
									.empty()
									.append(
										// Title
										(jQuery)( "<p></p>" )
											.addClass( "wp_playbuzz_title" )
											.text( item.title )
									)
									.append(
										// Meta
										(jQuery)( "<p></p>" )
											.addClass( "wp_playbuzz_meta" )
											.text( translation.created_by + " " ).append(
												(jQuery)( "<span></span>" )
												.addClass( "wp_playbuzz_author" )
												.text( item.channelName )
											)
											.append( " " + translation.on + " " + item_date( item.publishDate ) )
									);

							} else {

								// Set playbuzz logo
								(jQuery)( tinyMCE.activeEditor.dom.doc.body )
									.find( "#playbuzz_placeholder_" + id )
									.attr( "src", url + '/../img/playbuzz-placeholder.png' );

								// Set "item not found" text
								(jQuery)( tinyMCE.activeEditor.dom.doc.body )
									.find( "#playbuzz_info_" + id )
									.empty()
									.append(
										// Title
										(jQuery)( "<p></p>" )
											.addClass( "wp_playbuzz_title" )
											.text( translation.item_doesnt_exist )
									)
									.append(
										// Meta
										(jQuery)( "<p></p>" )
											.addClass( "wp_playbuzz_meta" )
											.text( translation.check_shortcode_url )
									);

							}

						}

					}
				);

                return createContainer(id, encodedShortcodeAttributes)
			}

			function placeholder_to_short_code(match, tag) {
				// Extract shortcode attributes from <div data-playbuzz-attr="...">
				var data = get_attr( tag, 'data-playbuzz-attr' );
				return data ? '<p>[playbuzz-item' + data + ']</p>' : match;
			}

			function playbuzz_embedcode_to_short_code(embed_code_div) {

				var data_attr_pattern = /data[^"]*"[^"]*"/g;
				var shortcodeName = {
					'data-id': 'item',
					'data-show-share': 'shares',
					'data-show-info': 'info'
				};

				var attributes = '';
				var match;

				while (match = data_attr_pattern.exec( embed_code_div )) {
					var attr = match[0];
					var embedParamName = attr.split( '=' )[0];
					attributes += attr.replace( embedParamName, ' ' + shortcodeName[embedParamName] );
				}

				return '<p>[playbuzz-item' + attributes + ']</p>';
			}

			// Replace the item info box with the shortcode
			// And remove playbuzz embed-code javascript tag
			editor.on(
				'GetContent', function (event) {
					event.content = event.content.replace( playbuzz_place_holder_pattern, placeholder_to_short_code );
				}
			);

			// pre paste on visual editor
			editor.on(
				'PastePreProcess', function (e) {

					var text = $( '<textarea />' ).html( e.content ).text();

					e.content = text
						.replace( playbuzz_embed_code_pattern, playbuzz_embedcode_to_short_code )
						.replace( playbuzz_javascript_pattern, '' )
						.replace( pb_shortcode, short_code_to_placeholder );
				}
			);

			// Item edit popup
			editor.on(
				'click', function (e) {

					var $target = $( e.target );
					// Delete item
					if ($target.hasClass( 'wp_playbuzz_delete' )) {
						var $item = (jQuery)( $target.closest( '.wp_playbuzz_container' ) )[0];
						var id = $item ? (jQuery)( $item ).attr( 'data-wp-pb-id' ) : 'none';
						delete_playbuzz_item_shortcode( id );
						(jQuery)( '.playbuzz_popup_overlay_container' ).remove();
					}

					// Edit item
					if ($target.hasClass( 'wp_playbuzz_buttons' ) || $target.hasClass( 'wp_playbuzz_edit' )) {
						// Extract shortcode attributes stored in <div data-playbuzz-attr="...">
						var attr = $target.attr( 'data-playbuzz-attr' );
						var $item = (jQuery)( $target.closest( '.wp_playbuzz_container' ) )[0];
						var id = $item ? (jQuery)( $item ).attr( 'data-wp-pb-id' ) : 'none';

						attr = window.decodeURIComponent( attr );

						// Set values
						var item_url = get_attr( attr, 'url' ),
							itemId = get_attr( attr, 'item' ),
							info = get_attr( attr, 'info' ),
							shares = get_attr( attr, 'shares' ),
							comments = get_attr( attr, 'comments' ),
							recommend = get_attr( attr, 'recommend' ),
							margin_top = get_attr( attr, 'margin-top' ),
							width = get_attr( attr, 'width' ),
							height = get_attr( attr, 'height' ),
							links = get_attr( attr, 'links' ),
							tags = get_attr( attr, 'tags' ),
							format = get_attr( attr, 'format' ),
							itemPath = item_url.split( 'playbuzz.com/' ).pop(),
							itemPathArray = itemPath.split( "/" ),
							creatorName = itemPathArray[0],
							gameName = itemPathArray[1];

						var data = {
							size: 1,
							moderation: "none"
						};

						if (item_url) {
							data.alias = creatorName + "/" + gameName;
						} else {
							data.id = itemId;
						}

						// Which settings to use ? site default or custom item settings
						var settings_to_use = ((info.length > 0) || (shares.length > 0) || (comments.length > 0) || (recommend.length > 0) || (margin_top.length > 0) || ( ! isNaN( margin_top ) && margin_top.trim() != '')) ? 'custom' : 'default';

						// Open Playbuzz Popup
						search.playbuzz_popup();

						// Create item popup structure
						playbuzz_item_popup_structure( settings_to_use, item_url, info, shares, comments, recommend, margin_top, width, height, links, tags, itemId, format );

						// Item Preview
						(jQuery).ajax(
							{
								url: apiBaseUrl,
								type: "get",
								dataType: "json",
								data: data,
								error: function (data) {

									// Clear preview
									(jQuery)( "#playbuzz_item_preview" ).empty();
									console.error( "Couldn't get data: ", data );

								},
								success: function (data) {

									if (data.payload.items.length > 0) {

										var item = data.payload.items[0];

										// Create preview
										(jQuery)( "#playbuzz_item_preview" ).empty().append(
											(jQuery)( "<table></table>" ).append(
												(jQuery)( "<tbody></tbody>" ).append(
													(jQuery)( "<tr></tr>" ).attr( "valign", "top" ).append(
														(jQuery)( "<td></td>" ).addClass( "playbuzz_item_thumb" )
													).append(
														(jQuery)( "<td></td>" ).addClass( "playbuzz_item_info" )
													)
												)
											)
										);

										// Add thumb
										(jQuery)( "<p></p>" ).addClass( "playbuzz_item_thumb" ).appendTo( "td.playbuzz_item_thumb" );
										(jQuery)( "<img>" ).attr( "src", item.imageLarge ).appendTo( "p.playbuzz_item_thumb" );

										// Add info
										(jQuery)( "<p></p>" ).addClass( "playbuzz_item_title" ).appendTo( "td.playbuzz_item_info" ).text( item.title );
										var $pbItemMeta = (jQuery)( "<p></p>" ).addClass( "playbuzz_item_meta" ).appendTo( "td.playbuzz_item_info" ).text( translation.created_by + " " )
										var channelLinkElement = createChannelLinkElement( item );

										$pbItemMeta.append( channelLinkElement );
										$pbItemMeta.append( " " + translation.on + " " + item_date( item.publishDate ) );

										(jQuery)( "<p></p>" ).addClass( "playbuzz_item_desc" ).appendTo( "td.playbuzz_item_info" ).text( item.description );
										(jQuery)( "<p></p>" ).addClass( "playbuzz_item_view_type_link" ).appendTo( "td.playbuzz_item_info" );
										(jQuery)( "<span></span>" ).addClass( "playbuzz_item_type" ).appendTo( "p.playbuzz_item_view_type_link" ).text( playbuzz_item_type( item.format ) );
										(jQuery)( "<span></span>" ).addClass( "playbuzz_item_link" ).appendTo( "p.playbuzz_item_view_type_link" );
										(jQuery)( "<a></a>" ).attr( "target", "_blank" ).attr( "href", item.playbuzzUrl ).appendTo( ".playbuzz_item_link" ).text( translation.preview_item );

									}

								}
							}
						);

						function createChannelLinkElement(item) {
							var channelAnchor = document.createElement( 'a' );
							var channelNameNode = document.createTextNode( item.channelName );

							channelAnchor.appendChild( channelNameNode );
							channelAnchor.setAttribute( 'target', '_blank' );
							channelAnchor.setAttribute( 'href', 'http://www.playbuzz.com/' + item.channelAlias );

							var span = document.createElement( 'span' );
							span.appendChild( channelAnchor );

							return span;
						}

						// Set/Change fields visibility
						function settings_visibility() {
							if ((jQuery)( "input[type='radio'][name='playbuzz_item_settings']:checked" ).val() == 'default') {
								(jQuery)( ".settings_half" ).addClass( "settings_disabled" );
								(jQuery)( "#playbuzz_item_settings_info" ).prop( "disabled", true );
								(jQuery)( "#playbuzz_item_settings_shares" ).prop( "disabled", true );
								(jQuery)( "#playbuzz_item_settings_recommend" ).prop( "disabled", true );
								(jQuery)( "#playbuzz_item_settings_comments" ).prop( "disabled", true );
								(jQuery)( "#playbuzz_item_settings_margin" ).prop( "disabled", true );
								(jQuery)( "#playbuzz_item_settings_margin_top" ).prop( "disabled", true );
							} else {
								(jQuery)( ".settings_half" ).removeClass( "settings_disabled" );
								(jQuery)( "#playbuzz_item_settings_info" ).prop( "disabled", false );
								(jQuery)( "#playbuzz_item_settings_shares" ).prop( "disabled", false );
								(jQuery)( "#playbuzz_item_settings_recommend" ).prop( "disabled", false );
								(jQuery)( "#playbuzz_item_settings_comments" ).prop( "disabled", false );
								(jQuery)( "#playbuzz_item_settings_margin" ).prop( "disabled", false );
								if ((jQuery)( "#playbuzz_item_settings_margin" ).prop( "checked" )) {
									(jQuery)( "#playbuzz_item_settings_margin_top" ).prop( "disabled", false );
								} else {
									(jQuery)( "#playbuzz_item_settings_margin_top" ).prop( "disabled", true );
								}
							}
						}

						settings_visibility();
						(jQuery)( "input[type='radio'][name='playbuzz_item_settings']:radio" ).change(
							function () {
								settings_visibility();
							}
						);

						// Margin-top
						if ( ! isNaN( margin_top ) && margin_top.trim() != '') {
							(jQuery)( "#playbuzz_item_settings_margin" ).prop( 'checked', true );
							(jQuery)( "#playbuzz_item_settings_margin_top" ).prop( "disabled", false );
						} else {
							(jQuery)( "#playbuzz_item_settings_margin_top" ).prop( "disabled", true );
						}

						// Change margin top
						(jQuery)( "#playbuzz_item_settings_margin" ).change(
							function () {
								if ((jQuery)( this ).is( ':checked' )) {
									(jQuery)( "#playbuzz_item_settings_margin_top" ).prop( "disabled", false );
								} else {
									(jQuery)( "#playbuzz_item_settings_margin_top" ).prop( "disabled", true );
								}
							}
						);

						// Click Update button
						(jQuery)( ".playbuzz_item_update_button" ).click(
							function () {

								// start shortcode tag
								var shortcode_str = '[playbuzz-item wp-pb-id="' + id + '"';

								// use site default settings or custom settings
								default_or_custom = (jQuery)( "input[type='radio'][name='playbuzz_item_settings']:checked" ).val();

								var new_item_id = (jQuery)( "#playbuzz_item_settings_id" );

								if (typeof new_item_id != 'undefined' && new_item_id.length && new_item_id.val() != '') {
									shortcode_str += ' item="' + new_item_id.val() + '"';
								} else {
									// add "url"
									new_item_url = (jQuery)( "#playbuzz_item_settings_url" );
									if (typeof new_item_url != 'undefined' && new_item_url.length && new_item_url.val() != '') {
										shortcode_str += ' url="' + new_item_url.val() + '"';
									}
								}

								// add "info"
								new_info = (jQuery)( "#playbuzz_item_settings_info" ).prop( "checked" );
								if (default_or_custom == 'custom') {
									shortcode_str += ' info="' + new_info + '"';
								}

								// add "shares"
								new_shares = (jQuery)( "#playbuzz_item_settings_shares" ).prop( "checked" );
								if (default_or_custom == 'custom') {
									shortcode_str += ' shares="' + new_shares + '"';
								}

								// add "comments"
								new_comments = (jQuery)( "#playbuzz_item_settings_comments" ).prop( "checked" );
								if (default_or_custom == 'custom') {
									shortcode_str += ' comments="' + new_comments + '"';
								}

								// add "recommend"
								new_recommend = (jQuery)( "#playbuzz_item_settings_recommend" ).prop( "checked" );
								if (default_or_custom == 'custom') {
									shortcode_str += ' recommend="' + new_recommend + '"';
								}

								// add "links"
								new_links = (jQuery)( "#playbuzz_item_settings_links" );
								if (typeof new_links != 'undefined' && new_links.length && new_links.val() != '') {
									shortcode_str += ' links="' + new_links.val() + '"';
								}

								// add "tags"
								new_tags = (jQuery)( "#playbuzz_item_settings_tags" );
								if (typeof new_tags != 'undefined' && new_tags.length && new_tags.val() != '') {
									shortcode_str += ' tags="' + new_tags.val() + '"';
								}

								// add "width"
								new_width = (jQuery)( "#playbuzz_item_settings_width" );
								if (typeof new_width != 'undefined' && new_width.length && new_width.val() != '' && new_width.val() != 'auto') {
									shortcode_str += ' width="' + new_width.val() + '"';
								}

								// add "height"
								new_height = (jQuery)( "#playbuzz_item_settings_height" );
								if (typeof new_height != 'undefined' && new_height.length && new_height.val() != '' && new_height.val() != 'auto') {
									shortcode_str += ' height="' + new_height.val() + '"';
								}

								format = (jQuery)( "#playbuzz_item_settings_format" );
								if (typeof format != 'undefined' && format.length && format.val() != '') {
									shortcode_str += ' format="' + format.val() + '"';
								}

								// add "margin-top"
								new_margin_top = (jQuery)( "#playbuzz_item_settings_margin_top" );
								if (default_or_custom == 'custom' && typeof new_margin_top != 'undefined' && new_margin_top.length && new_margin_top.val() != '' && new_margin_top.val() != '0' && new_margin_top.val() != '0px' && (jQuery)( "#playbuzz_item_settings_margin" ).is( ':checked' )) {
									shortcode_str += ' margin-top="' + new_margin_top.val() + '"';
								}

								// End shortcode tag
								shortcode_str += ']';

								// Remove settings modal
								(jQuery)( '.playbuzz_popup_overlay_container' ).remove();

								// Replace shortcode in the editor
								set_playbuzz_item_shortcode( id, shortcode_str );
							}
						);

					}

				}
			);

		}
	);

})();
