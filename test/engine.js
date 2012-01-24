var engineTestPlugins = require('./fixtures/engine-plugins');

QUnit.module("Hitch");
asyncTest("engine is global", function(){
	var g = helper();
	setTimeout(function(){
		ok(g.window.Hitch, "Hitch is global");
		start();
	},200);
});

QUnit.module("Hitch API");
asyncTest("rules and plugins exposed", function(){
	var g = helper();
	setTimeout(function(){
		ok(g.window.Hitch.getRules(), "Rules are exposed");
		equals(g.window.Hitch.getRules().length, 0, "Rule count is 0 on initialization");
		ok(g.window.Hitch.getHitches(), "Plugins are exposed");
		equals(g.window.Hitch.getHitches().length, 1, "Plugin count is 1 on initialization");
		start();
	},200);
});

asyncTest("plugins contain default set", function(){
	// TODO: Maybe the data structure should be a hash instead of array 
	// to allow for named indexing?
	var g = helper();
	setTimeout(function(){
		var pluginsAny = g.window.Hitch.getHitches()[0];
		equals(pluginsAny.name, "-hitch-any", "-hitch-any name");
		equals(pluginsAny.base, '', "-hitch-any has an empty base");
		// TODO: Work up a fixture for this test
		// ok(pluginsAny.fn(match, '#test-fixture'), "-hitch-any fn works");
		start();
	},200);
});

asyncTest("plugins addition", function(){
	var g = helper();
	setTimeout(function(){
		var testPlugin = {
			name: 'testPlugin',
			base: '',
			filter: function(){ return false; }
		},
		badPlugin = { name: '' },
		pluginsCount = g.window.Hitch.list().length;
		g.window.Hitch.add(testPlugin);
		equals(pluginsCount + 1, 2, "test plugin added");
		raises(function(){
			Hitch.add(badPlugin);
		},"must not allow plugins without names");
		start();
	},200);
});


QUnit.module("mods registered ok with link and @ rule requires...");
asyncTest("false-return registered with link", function(){
	var g = helper(
		'<link type="text/css" href="support/libs/fake.css" rel="stylesheet" x-hitch-interpret="true"></link>'
	);
	setTimeout(function(){
		setTimeout(function(){
			ok(g.window.added, "the window.added property should have been set when hitch was fetched/loaded");
			ok(g.window['false-return'], "false-return global should be set");
			ok(g.window['false-return-inited'], "init should have been called");
			ok(g.document.querySelectorAll('._0').length===0, 'The filter should not affect the test-fixture node');
			start();
		},200);
	},200);
	
});


QUnit.module("mods registered ok with inline style and JS API");
asyncTest("false-return registered with JS API", function(){
	var g = helper(
		'<style x-hitch-interpret="true"> div:-false-return() { color: red; } </style>',
		'<script type="text/javascript">  window.added=true; Hitch.add({name: "-false-return",base: "",filter: function(match, args){ '
			 + 'window["false-return"] = true; return true;}});  </script>'
	);
	setTimeout(function(){
		ok(g.window.added, "the window.added property should have been set when hitch was fetched/loaded");
		ok(g.window['false-return'], "false-return global should be set");
		ok(g.document.querySelectorAll('._0').length===1, 'The filter should affect the test-fixture node');
		start();
	},200);
	
});


QUnit.module("Unrequired/Unprovided modules should be left 'as is' and not registered...");
asyncTest("false-return unregistered no breaking", function(){
	var g = helper('<style x-hitch-interpret="true"> div:-false-return() { color: red; } </style>');
	setTimeout(function(){		
		ok(g.window.Hitch.list().indexOf('-false-return')===-1,'no module should be defined');
		ok(!g.window['false-return'], "false-return global should be set");
		ok(!g.window['false-return-inited'], "init should have been called");
		ok(g.document.querySelectorAll('._0').length===0, 'Filter should not affect the test-fixture node');
		start();
	},200);
	
});



QUnit.module("Hitch HTML hitch-widget attribute registers correctly...");
asyncTest("false-return registered via x-hitch-widget url", function(){
	var g = helper(
		'<style x-hitch-interpret="true"> div:-false-return() { color: red; } </style>',
		'<span x-hitch-widget="fake-hitch.js"> </span>',
		''
	);	
	setTimeout(function(){		
		ok(g.window.added, "the window.added property should have been set when hitch was fetched/loaded");
		ok(g.window['false-return'], "false-return global should be set");
		ok(g.document.querySelectorAll('._0').length===0, 'Filter should not affect the test-fixture node');
		start();
	},200);
});


QUnit.module("Hitch HTML hittch-widget attribute accepts package: correctly...");
asyncTest("bkardell.math via x-hitch-widget package", function(){
	var g = helper(
		'<style x-hitch-interpret="true"> div:-math-greaterthan("data-val",10){ color: red; } </style>',
		'<span x-hitch-widget="package:bkardell.math/1"> </span>',
		'<div data-val="0"> </div> <div data-val="11"> </div> <div> </div> '
	);	
	setTimeout(function(){		
		// All we can really do in this env (I think) is verify the url of the script tag
		ok(
			g.window.document.head.innerHTML.indexOf(
				'src="http://www.hitchjs.com/use/bkardell.math/1.js"'
			) !== -1
		);
		start();
	},2000);
	
});


QUnit.module("Adding Precompiled rules...");
asyncTest("precompiled rules can be added", function(){
	// Note the fact that \n's in the object create a problem for our test...
	var g = helper(
		'',
		'<script type="text/javascript" src="fake-hitch.js"></script>'
		+ '<script type="text/javascript">'
		+ '\nvar xx = {"rules":["/* was: div:-false-return() */div._0 { color: red; }"],"segIndex":{"div":{"hitches":{":-false-return":[{"sid":0,"rid":0,"cid":0,"args":"","base":"*"}]},"orig":"/* was: div:-false-return() */div._0 "}},"plugins":[]};'
		+ '\nHitch.addCompiledRules(xx);'
		+ '\n</script>',
		''
	);	
	expect(5);
	setTimeout(function(){		
		ok(g.window.added, "the window.added property should have been set when hitch was fetched/loaded");
		g.window.console.log("rulez: " + JSON.stringify(g.window.Hitch.getRules(),null,4));
		equals(g.window.Hitch.getRules().length, 1, g.window.Hitch.getRules().length + " expected 1");
		ok(g.window['false-return-inited'], "false-return-inited global should be set");
		ok(g.window['false-return'], "false-return global should be set");
		ok(g.document.querySelectorAll('._0').length===0, 'Filter should not affect the test-fixture node');
		start();
	},200);
	
});

