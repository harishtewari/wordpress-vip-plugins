<?php /*

This plugins is still in beta. Want to try it? Contact us. :)

**************************************************************************

Plugin Name: WordPress.com VIP Search Add-On
Description: Super-charged search with faceting, powered by ElasticSearch technology.
Author:      Automattic
Author URI:  http://automattic.com/

**************************************************************************

Copyright (C) 2012-2013 Automattic

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License version 2 or greater,
as published by the Free Software Foundation.

You may NOT assume that you can use any other version of the GPL.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

The license for this software can likely be found here:
http://www.gnu.org/licenses/gpl-2.0.html

**************************************************************************

TODO:

* PHPDoc

**************************************************************************/

require_once( __DIR__ . '/widget-facets.php' );
require_once( __DIR__ . '/class.es-wpcom-searchresult-posts-iterator.php' );

class WPCOM_elasticsearch {

	public $facets = array();

	private $additional_indices;

	private $do_found_posts;
	private $found_posts = 0;

	private $search_result;

	private $original_blog_id;

	private static $instance;

	private function __construct() {
		/* Don't do anything, needs to be initialized via instance() method */
	}

	public function __clone() { wp_die( "Please don't __clone WPCOM_elasticsearch" ); }

	public function __wakeup() { wp_die( "Please don't __wakeup WPCOM_elasticsearch" ); }

	public static function instance() {
		if ( ! isset( self::$instance ) ) {
			self::$instance = new WPCOM_elasticsearch;
			self::$instance->setup();
		}
		return self::$instance;
	}

	public function setup() {
		if ( ! function_exists( 'es_api_search_index' ) )
			return;

		if ( function_exists( 'es_api_get_index' ) && is_admin() && ! es_api_get_index( parse_url( site_url(), PHP_URL_HOST ), get_current_blog_id() ) ) {
			add_action( 'admin_notices', array( $this, 'admin_notice_no_index' ) );
			return;
		}

		add_action( 'widgets_init', array( $this, 'action__widgets_init' ) );

		if ( ! is_admin() ) {
			$this->init_hooks();
		}
	}

	public function init_hooks() {
		// Checks to see if we need to worry about found_posts
		add_filter( 'post_limits_request', array( $this, 'filter__post_limits_request' ), 999, 2 );

		# Note: Advanced Post Cache hooks in at 10 so it's important to hook in before that

		// Run the ES query and kill the standard search query - allow the 'the_posts' filter to handle inflation
		add_filter( 'posts_request', array( $this, 'filter__posts_request' ), 5, 2 );

		// Nukes the FOUND_ROWS() database query
		add_filter( 'found_posts_query', array( $this, 'filter__found_posts_query' ), 5, 2 );

		// Since the FOUND_ROWS() query was nuked, we need to supply the total number of found posts
		add_filter( 'found_posts', array( $this, 'filter__found_posts' ), 5, 2 );

		// Hook into the_posts to return posts from the ES results
		add_filter( 'the_posts', array( $this, 'filter__the_posts' ), 5, 2 );

		// Adjust es query args, if necessary
		add_filter( 'wpcom_elasticsearch_query_args', array( $this, 'filter__wpcom_elasticsearch_query_args' ), 5, 2 );
	}

	public function admin_notice_no_index() {
		echo '<div class="error"><p>' . __( 'WordPress.com VIP Search Add-On needs a little extra configuration behind the scenes. Please contact support to make it happen.' ) . '</p></div>';
	}

	public function action__widgets_init() {
		register_widget( 'WPCOM_elasticsearch_Widget_Facets' );
	}

	public function filter__post_limits_request( $limits, $query ) {
		if ( ! $query->is_search() )
			return $limits;

		if ( empty( $limits ) || $query->get( 'no_found_rows' ) ) {
			$this->do_found_posts = false;
		} else {
			$this->do_found_posts = true;
		}

		return $limits;
	}

	public function filter__the_posts( $posts, $query ) {
		if ( ! $query->is_main_query() || ! $query->is_search() )
			return $posts;

		if ( ! is_array( $this->search_result ) )
			return $posts;

		// This class handles the heavy lifting of transparently switching blogs and inflating posts
		$this->posts_iterator = new ES_WPCOM_SearchResult_Posts_Iterator();
		$this->posts_iterator->set_search_result( $this->search_result );

		$posts = array();

		// We have to return something in $posts for regular search templates to work, so build up an array
		// of simple, un-inflated WP_Post objects that will be inflated by ES_WPCOM_SearchResult_Posts_Iterator in The Loop
		foreach ( $this->search_result['results']['hits'] as $result ) {
			// Create an empty WP_Post object that will be inflated later
			$post = new stdClass();

			$post->ID 		= $result['fields']['post_id'];
			$post->blog_id 	= $result['fields']['blog_id'];

			// Run through get_post() to add all expected properties (even if they're empty)
			$post = get_post( $post );

			if ( $post )
				$posts[] = $post;
		}

		// Listen for the start/end of The Loop, to add some action handlers for transparently loading the post
		add_action( 'loop_start', 	array( $this, 'action__loop_start' ) );
		add_action( 'loop_end', 	array( $this, 'action__loop_end' ) );

		return $posts;
	}

	public function filter__posts_request( $sql, $query ) {
		global $wpdb;

		if ( ! $query->is_main_query() || ! $query->is_search() )
			return $sql;

		$page = ( $query->get( 'paged' ) ) ? absint( $query->get( 'paged' ) ) : 1;

		// Start building the WP-style search query args
		// They'll be translated to ES format args later
		$es_wp_query_args = array(
			'query'          => $query->get( 's' ),
			'posts_per_page' => $query->get( 'posts_per_page' ),
			'paged'          => $page,
		);

		// Look for query variables that match registered and supported facets
		foreach ( $this->facets as $label => $facet ) {
			switch ( $facet['type'] ) {
				case 'taxonomy':
					$query_var = $this->get_taxonomy_query_var( $this->facets[ $label ]['taxonomy'] );

					if ( ! $query_var )
						continue 2;  // switch() is considered a looping structure

					if ( $query->get( $query_var ) )
						$es_wp_query_args['terms'][ $this->facets[ $label ]['taxonomy'] ] = explode( ',', $query->get( $query_var ) );

					// This plugon's custom "categery" isn't a real query_var, so manually handle it
					if ( 'category' == $query_var && ! empty( $_GET[ $query_var ] ) ) {
						$slugs = explode( ',', $_GET[ $query_var ] );

						foreach ( $slugs as $slug ) {
							$es_wp_query_args['terms'][ $this->facets[ $label ]['taxonomy'] ][] = $slug;
						}
					}

					break;

				case 'post_type':
					if ( $query->get( 'post_type' ) && 'any' != $query->get( 'post_type' ) ) {
						$post_types_via_user = $query->get( 'post_type' );
					}
					elseif ( ! empty( $_GET['post_type'] ) ) {
						$post_types_via_user = explode( ',', $_GET['post_type'] );
					} else {
						$post_types_via_user = false;
					}

					$post_types = array();

					// Validate post types, making sure they exist and are public
					if ( $post_types_via_user ) {
						foreach ( (array) $post_types_via_user as $post_type_via_user ) {
							$post_type_object = get_post_type_object( $post_type_via_user );

							if ( ! $post_type_object || $post_type_object->exclude_from_search )
								continue;

							$post_types[] = $post_type_via_user;
						}
					}

					// Default to all non-excluded from search post types
					if ( empty( $post_types ) )
						$post_types = array_values( get_post_types( array( 'exclude_from_search' => false ) ) );

					$es_wp_query_args['post_type'] = $post_types;

					break;
			}
		}

		// Date
		if ( $query->get( 'year' ) ) {
			if ( $query->get( 'monthnum' ) ) {
				// Padding
				$date_monthnum = sprintf( '%02d', $query->get( 'monthnum' ) );

				if ( $query->get( 'day' ) ) {
					// Padding
					$date_day = sprintf( '%02d', $query->get( 'day' ) );

					$date_start = $query->get( 'year' ) . '-' . $date_monthnum . '-' . $date_day . ' 00:00:00';
					$date_end   = $query->get( 'year' ) . '-' . $date_monthnum . '-' . $date_day . ' 23:59:59';
				} else {
					$days_in_month = date( 't', mktime( 0, 0, 0, $query->get( 'monthnum' ), 14, $query->get( 'year' ) ) ); // 14 = middle of the month so no chance of DST issues

					$date_start = $query->get( 'year' ) . '-' . $date_monthnum . '-01 00:00:00';
					$date_end   = $query->get( 'year' ) . '-' . $date_monthnum . '-' . $days_in_month . ' 23:59:59';
				}
			} else {
				$date_start = $query->get( 'year' ) . '-01-01 00:00:00';
				$date_end   = $query->get( 'year' ) . '-12-31 23:59:59';
			}

			$es_wp_query_args['date_range'] = array( 'field' => 'date', 'gte' => $date_start, 'lte' => $date_end );
		}

		// Facets
		if ( ! empty( $this->facets ) ) {
			$es_wp_query_args['facets'] = $this->facets;
		}

		// You can use this filter to modify the search query parameters, such as controlling the post_type.
		// These arguments are in the format for wpcom_search_api_wp_to_es_args(), i.e. WP-style.
		$es_wp_query_args = apply_filters( 'wpcom_elasticsearch_wp_query_args', $es_wp_query_args, $query );
		

		// Convert the WP-style args into ES args
		$es_query_args = wpcom_search_api_wp_to_es_args( $es_wp_query_args );

		$es_query_args['fields'] = array( 
			'post_id',
			'blog_id'
		);

		// This filter is harder to use if you're unfamiliar with ES but it allows complete control over the query
		$es_query_args = apply_filters( 'wpcom_elasticsearch_query_args', $es_query_args, $query );

		// Do the actual search query!
		$this->search_result = es_api_search_index( $es_query_args, 'blog-search' );

		if ( is_wp_error( $this->search_result ) || ! is_array( $this->search_result ) || empty( $this->search_result['results'] ) || empty( $this->search_result['results']['hits'] ) ) {
			$this->found_posts = 0;
			return '';
		}

		// Total number of results for paging purposes
		$this->found_posts = $this->search_result['results']['total'];

		// Don't select anything, posts are inflated by ES_WPCOM_SearchResult_Posts_Iterator in The Loop,
		// to account for multi site search
		return '';
	}

	public function filter__found_posts_query( $sql, $query ) {
		if ( ! $query->is_main_query() || ! $query->is_search() )
			return $sql;

		return '';
	}

	public function filter__found_posts( $found_posts, $query ) {
		if ( ! $query->is_main_query() || ! $query->is_search() )
			return $found_posts;

		return $this->found_posts;
	}

	public function filter__wpcom_elasticsearch_query_args( $es_query_args, $query ) {
		if ( is_array( $this->additional_indices ) && ! empty( $this->additional_indices ) )
			$es_query_args['additional_indices'] = $this->additional_indices;

		return $es_query_args;
	}

	public function action__loop_start() {
		add_action( 'the_post', array( $this, 'action__the_post' ) );

		$this->original_blog_id = get_current_blog_id();
	}

	public function action__loop_end() {
		remove_action( 'the_post', array( $this, 'action__the_post' ) );

		// Restore the original blog, if we're not on it
		if ( get_current_blog_id() !== $this->original_blog_id )
			switch_to_blog( $this->original_blog_id );
	}

	public function action__the_post( &$post ) {
		global $id, $post, $wp_query, $authordata, $currentday, $currentmonth, $page, $pages, $multipage, $more, $numpages;

		$post = $this->get_post_by_index( $wp_query->current_post );

		if ( ! $post )
			return;

		// Do some additional setup that normally happens in setup_postdata(), but gets skipped
		// in this plugin because the posts hadn't yet been inflated.
		$authordata 	= get_userdata( $post->post_author );

		$currentday 	= mysql2date('d.m.y', $post->post_date, false);
		$currentmonth 	= mysql2date('m', $post->post_date, false);

		$numpages = 1;
		$multipage = 0;
		$page = get_query_var('page');
		if ( ! $page )
			$page = 1;
		if ( is_single() || is_page() || is_feed() )
			$more = 1;
		$content = $post->post_content;
		if ( false !== strpos( $content, '<!--nextpage-->' ) ) {
			if ( $page > 1 )
				$more = 1;
			$content = str_replace( "\n<!--nextpage-->\n", '<!--nextpage-->', $content );
			$content = str_replace( "\n<!--nextpage-->", '<!--nextpage-->', $content );
			$content = str_replace( "<!--nextpage-->\n", '<!--nextpage-->', $content );
			// Ignore nextpage at the beginning of the content.
			if ( 0 === strpos( $content, '<!--nextpage-->' ) )
				$content = substr( $content, 15 );
			$pages = explode('<!--nextpage-->', $content);
			$numpages = count($pages);
			if ( $numpages > 1 )
				$multipage = 1;
		} else {
			$pages = array( $post->post_content );
		}
	}

	/**
	 * Retrieve a full post by it's index in search results
	 */
	public function get_post_by_index( $index ) {
		return $this->posts_iterator[ $index ];
	}

	public function set_facets( $facets ) {
		$this->facets = $facets;
	}

	/**
	 * Set any additional blogs to query along with the current blog
	 *
	 * This method accepts an array of additional blog names, in the format of vip.wordpress.com,
	 * that should be queried.
	 * 
	 * @param array $domains The additional blogs to query
	 */
	public function set_additional_blogs( $domains = array() ) {
		$this->additional_indices = array();

		foreach( $domains as $domain ) {
			$blog_id = (int) get_blog_id_from_url( $domain );

			if ( $blog_id )
				$this->additional_indices[] = array( 'blog_id' => $blog_id );
		}
	}

	public function get_search_result( $raw = false ) {
		if ( $raw )
			return $this->search_result;

		return ( ! empty( $this->search_result ) && ! is_wp_error( $this->search_result ) && is_array( $this->search_result ) && ! empty( $this->search_result['results'] ) ) ? $this->search_result['results'] : false;
	}

	public function get_search_facets() {
		$search_result = $this->get_search_result();
		return ( ! empty( $search_result ) && ! empty( $search_result['facets'] ) ) ? $search_result['facets'] : array();
	}

	// Turns raw ES facet data into data that is more useful in a WordPress setting
	public function get_search_facet_data() {
		if ( empty( $this->facets ) )
			return false;

		$facets = $this->get_search_facets();

		if ( ! $facets )
			return false;

		$facet_data = array();

		foreach ( $facets as $label => $facet ) {
			if ( empty( $this->facets[ $label ] ) )
				continue;

			$facets_data[ $label ] = $this->facets[ $label ];
			$facets_data[ $label ]['items'] = array();

			// All taxonomy terms are going to have the same query_var
			if( 'taxonomy' == $this->facets[ $label ]['type'] ) {
				$tax_query_var = $this->get_taxonomy_query_var( $this->facets[ $label ]['taxonomy'] );

				if ( ! $tax_query_var )
					continue;

				$existing_term_slugs = ( get_query_var( $tax_query_var ) ) ? explode( ',', get_query_var( $tax_query_var ) ) : array();

				// This plugon's custom "categery" isn't a real query_var, so manually handle it
				if ( 'category' == $tax_query_var && ! empty( $_GET[ $tax_query_var ] ) ) {
					$slugs = explode( ',', $_GET[ $tax_query_var ] );

					foreach ( $slugs as $slug ) {
						$existing_term_slugs[] = $slug;
					}
				}
			}

			$items = array();
			if ( ! empty( $facet['terms'] ) ) {
				$items = (array) $facet['terms'];
			}
			elseif ( ! empty( $facet['entries'] ) ) {
				$items = (array) $facet['entries'];
			}

			// Some facet types like date_histogram don't support the max results parameter
			if ( count( $items ) > $this->facets[ $label ]['count'] ) {
				$items = array_slice( $items, 0, $this->facets[ $label ]['count'] );
			}

			foreach ( $items as $item ) {
				$query_vars = array();

				switch ( $this->facets[ $label ]['type'] ) {
					case 'taxonomy':
						$term = get_term_by( 'id', $item['term'], $this->facets[ $label ]['taxonomy'] );

						if ( ! $term )
							continue 2; // switch() is considered a looping structure

						// Don't allow refinement on a term we're already refining on
						if ( in_array( $term->slug, $existing_term_slugs ) )
							continue 2;

						$slugs = array_merge( $existing_term_slugs, array( $term->slug ) );

						$query_vars = array( $tax_query_var => implode( ',', $slugs ) );
						$name       = $term->name;

						break;

					case 'post_type':
						$post_type = get_post_type_object( $item['term'] );

						if ( ! $post_type || $post_type->exclude_from_search )
							continue 2;  // switch() is considered a looping structure

						$query_vars = array( 'post_type' => $item['term'] );
						$name       = $post_type->labels->singular_name;

						break;

					case 'date_histogram':
						$timestamp = $item['time'] / 1000;

						switch ( $this->facets[ $label ]['interval'] ) {
							case 'year':
								$query_vars = array(
									'year'     => date( 'Y', $timestamp ),
									'monthnum' => false,
									'day'      => false,
								);
								$name = date( 'Y', $timestamp );
								break;

							case 'month':
								$query_vars = array(
									'year'     => date( 'Y', $timestamp ),
									'monthnum' => date( 'n', $timestamp ),
									'day'      => false,
								);
								$name = date( 'F Y', $timestamp );
								break;

							case 'day':
								$query_vars = array(
									'year'     => date( 'Y', $timestamp ),
									'monthnum' => date( 'n', $timestamp ),
									'day'      => date( 'j', $timestamp ),
								);
								$name = date( 'F jS, Y', $timestamp );
								break;

							default:
								continue 3; // switch() is considered a looping structure
						}

						break;

					default:
						//continue 2; // switch() is considered a looping structure
				}

				$facets_data[ $label ]['items'][] = array(
					'url'        => add_query_arg( $query_vars ),
					'query_vars' => $query_vars,
					'name'       => $name,
					'count'      => $item['count'],
				);
			}
		}

		return $facets_data;
	}

	public function get_current_filters() {
		$filters = array();

		// Process dynamic query string keys (i.e. taxonomies)
		foreach ( $this->facets as $label => $facet ) {
			switch ( $facet['type'] ) {
				case 'taxonomy':
					$query_var = $this->get_taxonomy_query_var( $facet['taxonomy'] );

					if ( ! $query_var || empty( $_GET[ $query_var ] ) )
						continue 2;  // switch() is considered a looping structure

					$slugs = explode( ',', $_GET[ $query_var ] );

					$slug_count = count( $slugs );

					foreach ( $slugs as $slug ) {
						// Todo: caching here
						$term = get_term_by( 'slug', $slug, $facet['taxonomy'] );

						if ( ! $term || is_wp_error( $term ) )
							continue;

						$url = ( $slug_count > 1 ) ? add_query_arg( $query_var, implode( ',', array_diff( $slugs, array( $slug ) ) ) ) : remove_query_arg( $query_var );

						$filters[] = array(
							'url'  => $url,
							'name' => $term->name,
							'type' => ( ! empty( $facet['singular_title'] ) ) ? $facet['singular_title'] : get_taxonomy( $facet['taxonomy'] )->labels->singular_name,
						);
					}

					break;

				case 'post_type':
					if ( empty( $_GET['post_type'] ) )
						continue 2;

					$post_types = explode( ',', $_GET[ 'post_type' ] );

					$post_type_count = count( $post_types );

					foreach ( $post_types as $post_type ) {
						$post_type_object = get_post_type_object( $post_type );

						if ( ! $post_type_object )
							continue;

						$url = ( $post_type_count > 1 ) ? add_query_arg( 'post_type', implode( ',', array_diff( $post_types, array( $post_type ) ) ) ) : remove_query_arg( 'post_type' );

						$filters[] = array(
							'url'  => $url,
							'name' => $post_type_object->labels->singular_name,
							'type' => ( ! empty( $facet['singular_title'] ) ) ? $facet['singular_title'] : $label,
						);
					}

					break;

				case 'date_histogram':
					switch ( $facet['interval'] ) {
						case 'year':
							if ( empty( $_GET['year'] ) )
								continue 3;

							$filters[] = array(
								'url'  => remove_query_arg( array( 'year', 'monthnum', 'day' ) ),
								'name' => absint( $_GET['year'] ),
								'type' => __( 'Year', 'wpcom-elasticsearch' ),
							);

							break;

						case 'month':
							if ( empty( $_GET['year'] ) || empty( $_GET['monthnum'] ) )
								continue;

							$filters[] = array(
								'url'  => remove_query_arg( array( 'monthnum', 'day' ) ),
								'name' => date( 'F Y', mktime( 0, 0, 0, absint( $_GET['monthnum'] ), 14, absint( $_GET['year'] ) ) ),
								'type' => __( 'Month', 'wpcom-elasticsearch' ),
							);

							break;

						case 'day':

							if ( empty( $_GET['year'] ) || empty( $_GET['monthnum'] ) || empty( $_GET['day'] ) )
								continue;

							$filters[] = array(
								'url'  => remove_query_arg( 'day' ),
								'name' => date( 'F jS, Y', mktime( 0, 0, 0, absint( $_GET['monthnum'] ), absint( $_GET['day'] ), absint( $_GET['year'] ) ) ),
								'type' => __( 'Day', 'wpcom-elasticsearch' ),
							);

							break;

						default:
							continue 3;
					}

					break;

			} // end switch()
		}

		return $filters;
	}

	public function get_taxonomy_query_var( $taxonomy_name ) {
		$taxonomy = get_taxonomy( $taxonomy_name );

		if ( ! $taxonomy || is_wp_error( $taxonomy ) )
			return false;

		// category_name only accepts a single slug so make a custom, fake query var for categories
		if ( 'category_name' == $taxonomy->query_var )
			$taxonomy->query_var = 'category';

		return $taxonomy->query_var;
	}
}

function WPCOM_elasticsearch() {
	return WPCOM_elasticsearch::instance();
}
WPCOM_elasticsearch();
