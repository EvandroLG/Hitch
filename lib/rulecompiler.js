var fs = require('fs'),
    cssPluginsCompiler = require('./cssPluginsCompiler'), 
    src,
    compiledRulesBuff = [], 
    compiledCSSRulesFile, 
    compiledJSRulesFile;
    
//setup some global shit to make this work / pretend we are a browser 'just enough'   
$ = {
	getScript: function(x){
		eval(fs.readFileSync(x, 'UTF-8'));	
	}, 
	when: function(){
		return {
			then: function(t){
				t();
			}
		}
	}
};

document = { 
	head: { 'mozMatchesSelector': function(){} },
	addEventListener: function(){},
	body: { 'mozMatchesSelector': function(){} }
}; // body enough to make it work...


cssPlugins = require('./cssPlugins');

console.log('reading ' + process.argv[2]);
src = fs.readFileSync(process.argv[2], 'UTF-8');

cssPluginsCompiler(src, function(o){
	for(var i=0;i<o.rules.length;i++){
		compiledRulesBuff.push(o.rules[i]);
	}
	compiledCSSRulesFile = process.argv[2].replace('.css','-compiled.css');
	compiledJSRulesFile = process.argv[2].replace('.css', '-compiled.js');
	
	console.log('writing compiled css file...' + compiledCSSRulesFile);
	fs.writeFileSync(
		compiledCSSRulesFile,
		compiledRulesBuff.join("\n\n")
	);
	
	console.log('writing compiled js file...' + process.argv[2].replace('.css','-compiled.js'));
	fs.writeFileSync(
		compiledJSRulesFile,
		"cssPlugins.addCompiledRules({segIndex: " + JSON.stringify(o.segIndex) + "});"
	);
	
	console.log('Finished... Please be sure to include the following into your page:');
	console.log('\t<link rel="stylesheet"  href="'
		 + compiledCSSRulesFile + '" type="text/css" />');
	console.log('\t<script type="text/javascript" src="cssPlugins.js"></script>');
	for(var i=0;i<o.plugins.length;i++){
		console.log('\t<script type="text/javascript" src="' + o.plugins[i] + '"></script>');
	};
	console.log('\t<script type="text/javascript" src="' + compiledJSRulesFile + '"></script>');
});
	
	//fs.writeFileSync('plugin-interp-jquery.js',buff.join(";\n"));

