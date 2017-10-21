/* #####################################################################
    ghost-to-wordpress
    Version 1.0.0
    A script to turn Ghost blog JSON export into Wordpress import XML
    Copyright (C) 2017  Hugh Rundle

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

    You can contact Hugh on Twitter @hughrundle 
    or email hugh [at] hughrundle [dot] net
 ##################################################################### */

'use strict'

const fs = require('fs');
const jsontoxml = require('jsontoxml');
const ghostExport = process.argv[2];
// import the json file here
const backup = JSON.parse(fs.readFileSync(ghostExport, 'utf-8'));

//xml header
const now = new Date();
const header = 
`<?xml version="1.0" encoding="UTF-8" ?>

<!-- This is a WordPress eXtended RSS file generated by ghost-to-wordpress as an export of your site. -->
<!-- It contains information about your site's posts, pages, tags, and other content. -->
<!-- You may use this file to transfer that content from Ghost to Wordpress. -->
<!-- This file is not intended to serve as a complete backup of your site. -->

<!-- To import this information into a WordPress site follow these steps: -->
<!-- 1. Log in to that site as an administrator. -->
<!-- 2. Go to Tools: Import in the WordPress admin panel. -->
<!-- 3. Install the "WordPress" importer from the list. -->
<!-- 4. Activate & Run Importer. -->
<!-- 5. Upload this file using the form provided on that page. -->
<!-- 6. You will first be asked to map the authors in this export file to users -->
<!--    on the site. For each author, you may choose to map to an -->
<!--    existing user on the site or to create a new user. -->
<!-- 7. WordPress will then import each of the posts, pages, comments, categories, etc. -->
<!--    contained in this file into your site. -->

<!-- generator="ghost-to-wordpress" created="${now}" -->


<rss version="2.0"
	xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
	xmlns:content="http://purl.org/rss/1.0/modules/content/"
	xmlns:wfw="http://wellformedweb.org/CommentAPI/"
	xmlns:dc="http://purl.org/dc/elements/1.1/"
	xmlns:wp="http://wordpress.org/export/1.2/"
>
<channel>\n<wp:wxr_version>1.2</wp:wxr_version>\n`;

// create export file with header.
fs.writeFileSync('WP_import.xml', header);

// AUTHORS
console.log(`Converting ${backup.db[0].data.users.length} authors...`);
// for each users
for (let author of backup.db[0].data.users) {
	var authXML = jsontoxml({
		'wp:author': [
			{name:'wp:author_id', text:`${author.id}`},
			{name: 'wp:author_login', text:`<![CDATA[${author.slug}]]>`},
			{name: 'wp:author_email', text:`<![CDATA[${author.email}]]>`},
			{name: 'wp:author_display_name', text:`<![CDATA[${author.name}]]>`}
		],
	}, {prettyPrint:true, indent: '  '});
	// append this author's details to the export file.
	fs.appendFileSync('WP_import.xml', authXML);
};

// add generator info
fs.appendFileSync('WP_import.xml', '\n<generator>ghost-to-wordpress</generator>\n');

// POSTS
console.log(`Converting ${backup.db[0].data.posts.length} posts...`);
// for each post
for (let post of backup.db[0].data.posts) {
	// functions to process stuff from Ghost
	// get the author name
	function getAuthorName(){
		for (let author of backup.db[0].data.users) {
			if (author.id === post.author_id) {
				return author.slug;
			}
		}
	};
	// published or not?
	function getPostStatus(){
		if (post.status === 'published') {
			return 'publish'
		} else {
			return 'draft'
		}
	};
	// is it a post or a page?
	function getPostType(){
		if (post.page == '1') {
			return 'page'
		} else {
			return 'post'
		}
	};
	// is it featured/sticky?
	function isPostSticky(){
		if (post.featured == "1") {
			return true
		} else {
			return false
		}
	};

	// make the post XML
	var postXML = jsontoxml({
		item:[
			{name: 'title', text: post.title},
			{name: 'dc:creator', text:`<![CDATA[${getAuthorName()}]]>`},
			{name: 'description', text:' '},
			{name: 'content:encoded', text: `<![CDATA[${post.html}]]>`},
			{name: 'wp:post_date', text: `<![CDATA[${post.published_at}]]>`},
			{name: 'wp:post_name', text: `<![CDATA[${post.slug}]]>`},
			{name: 'wp:status', text: `<![CDATA[${getPostStatus()}]]>`},
			{name: 'wp:post_type', text: `<![CDATA[${getPostType()}]]>`},
			{name: 'wp:is_sticky', text: `<![CDATA[${isPostSticky()}]]>`},

			// reorganise the tags from Ghost into an object where keys are post IDs and values are arrays of tag IDs
			function (){
				var sendBack = '';
				function returnText(val){sendBack = sendBack + val}
				const tagStore = {};
				const postsTags = backup.db[0].data.posts_tags;
				for (var postTag in postsTags){
					if (!tagStore[postsTags[postTag].post_id]){
						tagStore[postsTags[postTag].post_id] = [];
					}
					tagStore[postsTags[postTag].post_id].push(postsTags[postTag].tag_id)
				}
					for (var taggedPost in tagStore) {
						if (taggedPost == post.id) {
							tagStore[taggedPost].forEach( function(tagNum){
								// each tag needs its own line in the XML file
								// note that Ghost does not have categories, only tags - there's no distinction
								const ghostTags = backup.db[0].data.tags;					
								ghostTags.forEach( function(t) {
									if (t.id == tagNum) {
										returnText(`\n  <category domain="post_tag" nicename="${t.name}"><![CDATA[${t.name}]]></category>`)
									} 
								})
							})
						}
					}
					return sendBack
				}
		]
	}, {prettyPrint:true, indent: '  '});

	// var tagsXML = jsontoxml(getTags());
	// apppend to the file
	fs.appendFileSync('WP_import.xml', postXML);
};

// close off file
const footer = '</channel>\n</rss>';

fs.appendFileSync('WP_import.xml', footer);
console.log('Your file is now ready to import into WordPress!');

