var Hitch = (function(){
	
	var 
		// Vendor-specific match function
		matchFn, 
	
		// Whether we need to emulate for IE8 
		emulate = ( typeof navigator !== 'undefined' && 
			navigator.appName == 'Microsoft Internet Explorer' && 
			navigator.userAgent.indexOf('MSIE 8') !== -1
		);


	// If it's webkit or IE - we have to shim the ability to watch attribute mods....
	if((document.head && document.head.webkitMatchesSelector) || emulate){
		Element.prototype._setAttribute = Element.prototype.setAttribute;
		Element.prototype.setAttribute = function(name, val) { 
			var e, prev, temp;
			prev = this.getAttribute(name); 
			this.setAttribute(name,val);
			testSubtree({
					"target": this, 
					"prevValue": prev, 
					"attrName": name, 
					"newValue": val
			});
		};
	}
	
	var query = function(el,q){ 
		return el.querySelectorAll(q);
	};
	
	var toArray = function(nl){
		var ret,i;
		if(!emulate){
			return Array.prototype.slice.call(nl, 0);
		}else{
			ret = [];
			for(i=0;i<nl.length;i++){
				ret.push(nl[i]);
			}
			return ret;
		}
	};
	
    var perf = { checks: 0, queries: 0 };

    var	
		// prefix of the vendor (browser)
		vendor,
		// on document load events whether to call ready by default
		defaultInit = true,
		// segIndex is how we optimize 
		segIndex, 
		// Store the compiled rules...
		rules = [], 
		// basically this is "known plugin configurations"
		plugins = [{ 
			/* emulated "super" matches - allows full complex selectors in match */ 
			name: "-plugins-any",
			base: '',
			fn: function(match, argsString){
				return match.matchesSelector(argsString);
			}
		}],
		// a ready fn... when things are ready to go, kicks things off
		ready, 
		// This will track data about rules that have aliases/filters 
		rulesWeCareAbout = [], 
		// Rules we register as native -- a superset of rules we care about
		nativeRules = [], 
		// This will help prevent infinite recursion
		subtreesemaphor = false,
		
		apply = function(filterName,potential,t,test,n){
			try{
				if(filters.map[filterName].init && !filters.map[filterName].inited){ 
					filters.map[filterName].init(potential);
					filters.map[filterName].inited = true;
				}
				x = filters.map[filterName].fn(n,test.args,{siblings: n.parentNode.children, location: normalizedUrl() });
				if(x){ 
					addMangledClass(t,test.cid);
				}else{
					removeMangledClass(t,test.cid);
				}
			}catch(e){}
		},
		
		// applies filters as they match the left part(s)
		searchUpward = function(el,q,last){
			var x, d, tmp, f, a;
			if(el.tagName !== 'BODY' && q.scan !== ''){
			for(var i in q.index){ // walk through each one in the index
					try{
						if(matchFn(el,i)){  // Do we match this one?
							for(f in q.index[i].filters){	// walk through each filter
								tmp = q.index[i].filters[f];
								for(a=0;a<tmp.length;a++){
									apply(f,[el],el,tmp[a],el);	
								}
							}
						}
					}catch(e){
						console.log('whoops...' + e.message);
					}
					
				}
				last = el;			
				return searchUpward(el.parentNode,q,last);
			}
			return last;
		},
		
		// add the element and all of its parents to an array in depth order (like NodeList) 
		grabAncestralTree = function(e,coll){
			while(e.tagName !== 'BODY'){
				coll.push(e);
				e = e.parentNode;
			}
			return coll;
		},
		
		// tests all elements of a subtree with the tester (see below)...
		testSubtree = function(t,isInit){
			var start = new Date().getTime(), 
				ancestralTree, 
				el = t.target || t, 
				potential = [];
				
			if(el.parentNode === null){ return; /* firebug... */ }
			if(t.type === 'DOMNodeRemoved'){
				// This event is before the removal, so we have to release control...
				setTimeout(function(){
					testSubtree({type: 'DOMNodeInserted', target: t.relatedNode, relatedNode: t.relatedNode},false);
				},1);
				return;
			}
					
			if(!subtreesemaphor){
				perf = { checks: 0, queries: 0 };
				subtreesemaphor = true;
				try{
					perf.queries++;
					// returns false if we can't target an upward search
					var maybeRules  = findPotentiallyRelevantRules(t);
					
					if(maybeRules){
						// we can do this and short-circuit return;
						el = searchUpward(el,maybeRules) || el;  // || document.body);
						return;
					}
					
					for(var i=0;i<potential.length;i++){
						// This allows us to detect class name changes
						potential[i]._oldclasses = potential[i].className;
					}	
					tester(el,(t.type === 'DOMNodeInserted') ? grabAncestralTree(t.relatedNode,[el]) : false);
				}catch(exc){
					// uhoh!
					console.log('uh oh...' + exc.message);
				}finally{
					perf.duration = new Date().getTime() - start + "ms";
					//console.log(JSON.stringify(perf));
					subtreesemaphor = false;
				}
			}
		},
		
		hasMangledClass = function(t,i){
			return new RegExp("_" + i).test((t.target || t).className);
		},
		
		addMangledClass = function(t,i){
			var e = (t instanceof NodeList) ? t : [t];
			for(var x=0;x<e.length;x++){
				if(!hasMangledClass(e[x],i)){
					(e[x].target || e[x]).className += " _" + i;
				}
			}
		}, 
		
		removeMangledClass = function(t,i){
			var e = (t instanceof NodeList) ? t : [t];
			for(var x=0;x<e.length;x++){
				if(hasMangledClass(e[x],i)){
				    (e[x].target || e[x]).className = (e[x].target || e[x]).className.replace(' _' + i, ''); 
				}
			}
		},
		
		wrappers = {
			'class': function(v){ return "." + v; },
			'id': function(v){ return "#" + v; },
			'attr': function(v){ return "[" + v; }
		},
		
		//TODO - this is weak... probably a better index for this should also 
		// be built by the native
		findPotentiallyRelevantRules = function(t){
			var temp, wrap, filteredSet = {}, rule, prefix = "", suffix = "", m = [], x = [], wrapped;
			if(t.attrName){  // It's some kind of attribute
				wrap = (wrappers[t.attrName]) ? wrappers[t.attrName] : wrappers.attr;
				for(var r in segIndex){
					m.push(r);
					temp = r + JSON.stringify(segIndex[r]);
					wrapped = wrap(t.attrName.trim());
					if(temp.indexOf(wrapped) !== -1){
						filteredSet[r] = segIndex[r];
					}
				}
			}else{
				// Something for tag names?
				return false;
			}
			return { scan: m.join(","), index: filteredSet };
		},
		
		// This is the primary tester that says "apply this rule" or don't...  
		tester = function(el,list,s){  
			var n,
				test,
				segments,
				x,
				tests,
				maybeRules = rulesWeCareAbout,
				potential,
				t,
				ancestral = {},
				last;
				
				
			// We have to see if this matches any of the rules we care about....
			for(test in segIndex){
				try{
					potential = list;
					if(list){ // inserts
						potential = list.concat(toArray(query(el,test)));
					}else if(el.querySelectorAll){
						potential = toArray(query(el,test));
					}
					for(var c=0;c<potential.length;c++){
						n = potential[c];
						t = {target: n};
						fs = segIndex[test].filters;
						for(var filterName in fs){
							tests = fs[filterName];
							for(var i=0;i<tests.length;i++){
							    apply(filterName,potential,t,tests[i],n);
							}
						}
					}
				}catch(e){
					console.log("invalid rule selector... " + e.message);
					// one invalid rule doesnt spoil the bunch... Example:
					// :not(.x,.y) will be valid someday, but it throws now... 
				}
			}
		},
		
		// helper function to drop the file.ext and return just the URL
		normalizedUrl = function() {
			var location = window.location.href.split("?")[0].split("/");
			location.pop();
			return location.join('/');
		},
		
		filters = {
			// known filters
			map: {},
			/* Simulate the parser so we can figure this shit out... */
			parseFilters:   function(){
				return rules;
			},
			
			init: function(){
				var head = document.getElementsByTagName('head')[0],
					bod = document.getElementsByTagName('body')[0],
					buff = [], 
					ns = document.createElement('style');
					
				if(nativeRules){
					for(i=0;i<nativeRules.length;i++){
						buff.push(nativeRules[i]);
					}
					try{
						//console.log(buff.join("\n\n"));
						ns.innerHTML = buff.join("\n\n");
						head.appendChild(ns);
					}catch(e){
						head.appendChild(ns);
						document.styleSheets[document.styleSheets.length-1].cssText = buff.join('\n\n');
					}
				}
				
				testSubtree(bod,head.webkitMatchesSelector);
				if(bod.addEventListener){ // IE8 grafts attribute modification... what about tree mod?
					bod.addEventListener('DOMAttrModified',testSubtree);
					bod.addEventListener('DOMNodeInserted',testSubtree);
					bod.addEventListener('DOMNodeRemoved',testSubtree);
					document.addEventListener('DOMSubtreeModified',function(t){
						if(!t.target._isSetting && t.target._oldclasses !== t.target.className){
							t.target._isSetting = true;
							t.target.setAttribute('class',t.target.className);
							t.target._oldclasses = t.target.className;
							t.target._isSetting = false;
						}
					});
				}
			},
			
			registerFilter: function(alias, base, filter, init){
				if(filter){
					filters.map[":" + alias] = {  fn: filter, base: base, init: init };
				}
			}
		};
		
	// Go!
	ready = function(){
		var matches, compiledForm, h = document.getElementsByTagName('head')[0];
		if(plugins){ // how could this be null/undefined?!
			for(var i=0;i<plugins.length;i++){
				filters.registerFilter(
					plugins[i].name,
					plugins[i].base,
					plugins[i].fn,
					plugins[i].init
				);
			}
			if(h.matchesSelector){ vendor = ""; matches = 'matchesSelector'; }
			else if(h.mozMatchesSelector){ vendor = "-moz-"; matches = 'mozMatchesSelector'; }
			else if(h.webkitMatchesSelector){  vendor = "-webkit-"; matches = 'webkitMatchesSelector'; }
			else if(h.oMatchesSelector){  vendor = "-o-"; matches = 'oMatchesSelector'; }
			else if(h.msMatchesSelector){ vendor = "-ms-";  matches = 'msMatchesSelector'; } 
			else{
				vendor = '-plugins-'; matches = 'pluginsMatchesSelector';
				matchFn = function(e,sel){
					return $(e).is(sel);
				};
			}
			if(!matchFn){
				matchFn = function(e,s){ 
					return e[matches](s); 
				};
			}
			
			compiledForm = filters.parseFilters()[0] || {}; // do we need more than 1?  {} for tests
			nativeRules = compiledForm.rules;  
			segIndex = compiledForm.segIndex;
			filters.init();
		}
	};
		
	//TODO: All browsers cool with addEventListener?
	try{
		document.addEventListener( "DOMContentLoaded", function(){
			if(defaultInit){
				ready();
			}
		}, false );
	}catch(e){
		document.onload = function(){
			if(defaultInit){
				ready();
			}
		};
	}
	
	return { 
		useManualInit: function(){ defaultInit = false; },
		
		init: function(){
			ready();
		},
		
		addCompiledRules: function(rDescs){
			rules = rules.concat(rDescs);
			return this;
		},
		
		addFilters: function(fDescs){
			plugins = plugins.concat(fDescs);
		},
		
		add: function(plugin){
			plugins.push(plugin);
		},
		
		getPluginNames: function(){
			var ret=[], i=0;
			for(;i<plugins.length;i++){
				ret.push(plugins[i].name);	
			}
			return ret;
		},
		
		getBase: function(p){
			for(var i=0;i<plugins.length;i++){
				if(p===plugins[i].name){
					return plugins[i].base;
				}	
			}
		},
		
		rules: rules,
		plugins: plugins
	};
}());

if(typeof module !== 'undefined' && module.exports){
	module.exports.Hitch = Hitch;
}