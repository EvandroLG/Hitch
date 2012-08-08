QUnit.module("Hitch Compiler Tests");

var compiler = HitchCompiler;
// Constants and @hitch-requires are mostly loaded inside the fixture.css file - see there for references.

asyncTest("Simple constants replacement", function(){
	setTimeout(function(){
		var statement = "h1{ color: green; } \n:-foo-bar{ color: red; } \nspan{ color: green; } \n";
		compiler(statement, function(comp){
			equal(comp.rules.length, 3, 'there should be 3 rules');
			equal(comp.rules[0].trim(), 'h1{ color: green; }', 'should be unchanged');
			equal(comp.rules[1].trim(), 'div, .x { color: red; }', 'should be div, .x { color: red; }');
			equal(comp.rules[2].trim(), 'span{ color: green; }', 'should be unchanged');
			start();
		});
	}, 50);
});

asyncTest("Simple constants replacement - all replaced", function(){
	setTimeout(function(){
		var statement = 'h1{ color: green; } \n:-foo-bar{ color: red; } \nspan :-foo-bar{ color: green; } \n';
		compiler(statement, function(comp){			
			equal(comp.rules.length, 3, 'there should be 3 rules');
			equal(comp.rules[1].trim(), 'div, .x { color: red; }','the rule should contain swapped constant values');
			equal(comp.rules[2].trim(), 'span div, .x { color: green; }','the rule should contain swapped constant values');
			start();
		});
	}, 50);
});

test("Constant replaced on whole string match", function(){
	var statement = '@-hitch-const :-foo-bar div, .x; \n @-hitch-const :-foo-bar2 span, .y; \n h1{ color: green; } \n:-foo-bar{ color: red; } \n:-foo-bar2{ color: green; } \n';
	compiler(statement, function(comp){
		equal(comp.rules.length, 3, 'there should be 3 rules');
		equal(comp.rules[1].trim(), 'div, .x { color: red; }','the rule should contain swapped constant values');
		equal(comp.rules[2].trim(), 'span, .y { color: green; }','the rule should contain swapped constant values');
	});
});

asyncTest("Constant replaced with @hitch-requires statement", function(){
	setTimeout(function(){
		var statement = ':-apple{ color: green; }';
		compiler(statement, function(comp){
			equal(comp.rules.length, 1, 'there should be 1 rule');
			equal(comp.rules[0].trim(), 'span.apple{ color: green; }','the rule should contain swapped constant values');
			start();
		});
	}, 50);
});

asyncTest("Simple rule inspection", function(){
	setTimeout(function(){
		var statement = "td:-requires-hitch(){ color: green; }",
			hitches;
		compiler(statement, function(comp){
			equal(comp.rules.length, 1, 'there should be 1 rule');
			ok(comp.segIndex.td, 'there should be a td entry in segIndex');
			hitches = comp.segIndex.td.hitches[":-requires-hitch"];
			ok(hitches, "requires-hitch should be in the segIndex");
			equal(hitches.length, 1, 'There should be only 1 applicable hitch');
			start();
		});
	},50);
});

asyncTest("Simple rule inspection with irrelevant trailing segment", function(){
	setTimeout(function(){
		var statement = "p:-requires-hitch() span{ color: green; }";
		compiler(statement, function(comp){
			equal(comp.rules.length, 1, 'there should be 1 rule');
			ok(comp.segIndex.p, 'there should be a p entry in segIndex');
			ok(!comp.segIndex.span, 'there should not be a span entry in segIndex');
			start();
		});
	},50);
});

asyncTest("Simple rule inspection with multiple segments", function(){
	setTimeout(function(){
		var statement = "ul:-requires-hitch(){ color: green; } li:-requires-hitch(){ color: blue; }";
		compiler(statement, function(comp){
			equal(comp.rules.length, 2, 'there should be 2 rules');
			ok(comp.segIndex.ul, 'there should be a ul entry in segIndex');
			ok(comp.segIndex.li, 'there should be a li entry in segIndex');
			start();
		});
	},50);
});

asyncTest("Simple rule inspection with relevant trailing segment", function(){
	setTimeout(function(){
		var statement = "div:-requires-hitch(1) span:-requires-hitch(2){ color: green; }",
			div,
			divspan;
		compiler(statement, function(comp){
			equal(comp.rules.length, 1, 'there should be 1 rule1');
			ok(comp.segIndex.div, 'there should be a div entry in segIndex');
			ok(comp.segIndex['div span'], 'there should be a div span entry in segIndex');
			start();
		});
	},50);
});

asyncTest("A inside B", function(){
	setTimeout(function(){
		var statement = "div:-requires-hitch(span:-js-hitch(2)){ color: green; }";
		compiler(statement, function(comp){
			equal(comp.rules.length, 1, 'there should be 1 rule');
			ok(comp.segIndex.span, 'there should be a span entry in segIndex');
			ok(comp.segIndex.div, 'there should be a div entry in segIndex');
			ok(comp.segIndex['div span'], 'there should be a div span entry in segIndex');			
			start();
		});
	}, 50);
});

asyncTest("Single line comment", function(){
	setTimeout(function(){
		var statement = "/* You suck */\ndiv:-requires-hitch(){ color: green; }\n";
		compiler(statement, function(comp){
			equal(comp.rules.length, 1, "there should be 1 rule");
			start();
		});
	}, 50);
});

asyncTest("Multi line comment", function(){
	setTimeout(function(){
		var statement = "/* \nYou suck \n*/\ndiv:-requires-hitch(){ color: green; }\n";
		compiler(statement, function(comp){
			equal(comp.rules.length, 1, "there should be 1 rule");
			start();
		});
	}, 50);
});

asyncTest("@import statement", function(){
	setTimeout(function(){
		var statement = "\n@import url('poop.css');\ndiv:-requires-hitch(){ color: green; }\n";
		compiler(statement, function(comp){
			equal(comp.rules.length, 1, "there should be 1 rule");
			start();
		});
	}, 50);
});

asyncTest("@page statement", function(){
	setTimeout(function(){
		var statement = "@page :right { \nmargin: 1em; \n}\ndiv:-requires-hitch(){ color: green; }\n";
		compiler(statement, function(comp){
			equal(comp.rules.length, 1, "there should be 1 rule");
			start();
		});
	}, 50);
});

asyncTest("@media statement", function(){
	setTimeout(function(){
		var statement = "@media print{\nBODY {\nfont-size: 10pt;\n }\n\nspan {\nfont-size: 20pt;\n }\n}\ndiv:-requires-hitch(){ color: green; }\n";
		compiler(statement, function(comp){
			equal(comp.rules.length, 1, "there should be 1 rule");
			start();
		});
	}, 50);
});

// Doesn't work
// :-media-time(99,4350) ~ a[data-time=0:00:00.099,0:00:04.350]
// Works
// :-media-time(99,4350) ~ a[data-time]
asyncTest("media-time pseudo-class parsing", function(){
	setTimeout(function(){
		var good = "div:-media-time(99,4350) ~ a[data-time] { color: green; }";
		var bad = "div:-media-time(99,4350) ~ a[data-time=0:00:00.099,0:00:04.350] { color: red; }";
		compiler(good, function(comp){
			equal(comp.rules.length, 1, "there should be 1 rule");
			ok(comp.rule.segIndex.div, "there should be div in segIndex");
			console.log('Good', comp);
		});
		compiler(bad, function(comp){
			equal(comp.rules.length, 1, "there should be 1 rule");
			ok(comp.rule.segIndex.div, "there should be div in segIndex");
			console.log('Bad', comp);
		});
		start();
	}, 50);
});