var cssPlugins = (function(){

	// If it's webkit - we have to shim this....
	if(document.head.webkitMatchesSelector){
		Element.prototype._setAttribute = Element.prototype.setAttribute
		Element.prototype.setAttribute = function(name, val) { 
		 var e = document.createEvent("MutationEvents"); 
		 var prev = this.getAttribute(name); 
		 this._setAttribute(name, val);
		 e.initMutationEvent("DOMAttrModified", true, true, null, prev, val, name, 2);
		 this.dispatchEvent(e);
		}
	}
	
    var perf = { checks: 0, queries: 0 };

    var	vendor,

		// on document load events whether to call ready by default
		defaultInit = true,
		
		// segIndex is how we optimize 
		segIndex, 
		
		// Store the compiled rules...
		compiled_cssplugin_rules = [], 
		
		// basically this is "known plugin configurations"
		cssplugin_selectors = [],
		
		// a ready fn... when things are ready to go, kicks things off
		ready, 
		
		// This will track data about rules that have aliases/filters 
		rulesWeCareAbout = [], 
		
		// Rules we register as native -- a superset of rules we care about
		nativeRules = [], 
		
		// This will help prevent infinite recursion
		subtreesemaphor = false,
		
		// applies filters as they match the left part(s)
		searchUpward = function(el,q,last){
			var x, d;
			if(el.tagName !== 'BODY' && q.scan !== ''){
				if(el.matchesSelector(q.scan)){
					for(var i=0;i<q.rules.length;i++){
						//debugger;
						x = filters.map[q.rules[i].filter].fn(el,q.rules[i].filterargs)
						d = q.rules[i].rid; //selector.match(/\._(\d)/)[1];
						(x) ? addMangledClass(el,d) : removeMangledClass(el,d);
					}
					last = el;
				}
				return searchUpward(el.parentNode,q,last);
			}
			return last;
		},
		
		/* add the element and all of its parents to an array in depth order (like NodeList) */
		grabAncestralTree = function(e,coll){
			while(e.tagName !== 'BODY'){
				coll.push(e);
				e = e.parentNode;
			}
			return coll;
		},
		
		// tests all elements of a subtree with the tester (see below)... 			
		testSubtree = function(t,isInit){
			var start = new Date().getTime(), ancestralTree;
			var el = t.target || t, potential = [];
			if(t.type === 'DOMNodeRemoved'){
				// This event is before the removal, so we have to release control...
				setTimeout(function(){
					testSubtree({type: 'DOMNodeInserted', target: t.relatedNode, relatedNode: t.relatedNode},false);
				},1);
				return;
			}
					
			if(!subtreesemaphor){
				perf = { checks: 0, queries: 0 };
				subtreesemaphor = true
				try{
					perf.queries++;
					// returns false if we can't target an upward search
					var maybeRules  = findPotentiallyRelevantRules(t);
					if(maybeRules){
						// we can do this and short-circuit return;
						var p = getFirstSegments(maybeRules);
						el = searchUpward(el,maybeRules) || el;  // || document.body);
						return;
					}
					
					// compile segment groups...
					groups = compileSegmentGroups(rulesWeCareAbout);
					for(var i=0;i<potential.length;i++){
						// This allows us to detect class name changes
						potential[i]._oldclasses = potential[i].className;
					}	
					tester(el,(t.type === 'DOMNodeInserted') ? grabAncestralTree(t.relatedNode,[el]) : false);
				}catch(exc){
					// uhoh!
					debugger;
					console.log(exc.message);
				}finally{
					perf.duration = new Date().getTime() - start + "ms";
					console.log(JSON.stringify(perf));
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
		
		// gets a comma seperated list of all segments in a filter (without compiled indexes)
		getSegmentsGroup = function(r){
			var ret = [];
			if(!r.segmentsGroup){
				for(var i=0;i<r.segments.length;i++){
					if(r.segments[i].filter){
						ret.push(r.segments[i].selector.replace(/._\d/,''));
					}
				}
				r.segmentsGroup = ret.join(',').replace("\:-" + vendor + "-any\(\)","");
			}				
			return r.segmentsGroup;
		},
		
		// gets the first segments for all rules (without compiled indexes)
		getFirstSegments = function(rs){
			var ret = [],selector;
			for(var i=0;i<rs.length;i++){
				if(rs[i].segments){
					selector = rs[i].segments[0].selector.replace(/._\d/,'');
					if(ret.indexOf(selector !== -1)){
						ret.push(selector);
					}
				}
			}
			return ret.join(",").replace("\:\-" + vendor + "\-any\(\)","");
		},
		
		// 
		findSegments = function(rule, criteria, t){
		    var sel, args, a = [], f = false, segment;
			for(var i=0;i<rule.segments.length;i++){
				segment = rule.segments[i];
				sel = segment.selector.replace(/\._\d/, "").replace("\:\-" + vendor + "\-any\(\)","");
				args = segment.filterargs;
				a.push(sel);
				if(
					(sel.indexOf(criteria) !== -1)
				    ||	
				    (args && args.indexOf(criteria) !== -1)
				){
					
					// you gotta join b and test those against filter...
					f = true;
					break;
				}
			}
			
			return { a: a.join(' '), b: i - (f) ? 0 : 1 };
		},
		
		wrappers = {
			'class': function(v){ return "." + v; },
			'id': function(v){ return "#" + v; },
			'attr': function(v){ return "[" + v; }
		},
		
		findPotentiallyRelevantRules = function(t){
			var wrap, ret = [], rule, prefix = "", suffix = "", m = [], x = [], wrapped;
			if(t.attrName){  // It's some kind of attribute
				wrap = (wrappers[t.attrName]) ? wrappers[t.attrName] : wrappers['attr'];
				for(var i=0;i<rulesWeCareAbout.length;i++){
					rule = rulesWeCareAbout[i];
					if(!rule.str){ rule.str = JSON.stringify(rule); }
					wrapped = wrap(t.newValue.trim());
					if(rule.str.indexOf(wrapped) !== -1 || 
						(wrap === wrappers.attr && rule.str.indexOf(t.attrName) !== -1)){
						rule.index = i;
						//debugger;
						var ttt = findSegments(rule,wrapped,t);
						if(ttt.a && m.indexOf(ttt.a) === -1){
							m.push(ttt.a);
						}
						rule.segments[ttt.b].rid = i;
						ret.push(rule.segments[ttt.b]);
					}
				}
			}else{
				// Something for tag names?
				return false;
			}
			return { scan: m.join(","), rules: ret };
		},
		
		compileSegmentGroups = function(rules){
			var ret = [], group, rule;
			for(var i=0;i<rules.length;i++){
				rule = rules[i];
				group = getSegmentsGroup(rule);
				if(ret.indexOf(group) === -1){
					ret.push(group);
				}
			}
			return ret;
		},
		
		getSegIndex = function(){
			var ret = [], segs, rule, segment, lastSeg = 0, sans, joint;
			if(!segIndex){
				segIndex = {};
				for(var i=0;i<rulesWeCareAbout.length;i++){
					rule = rulesWeCareAbout[i];
					segs = [];
					for(var x=0;x<rule.segments.length;x++){
						segment = rule.segments[x];
						sans = segment.selector.replace(/\._\d/, "");
						
						segs.push(sans);
						if(segment.filter){
							//debugger;
							joint = segs.join(' ');
							if(!segIndex[joint]){
								segIndex[joint] = { filters: {} };
							}
							if(!segIndex[joint].filters[segment.filter]){
								segIndex[joint].filters[segment.filter] = [];
							}
							segIndex[joint].filters[segment.filter].push({rid: i, args: segment.filterargs});
						}
					}
				}
			}
			return segIndex;
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
			var indx = getSegIndex();
			for(var test in indx){
				potential = list;
				if(list){ // inserts
					potential = list.concat(Array.prototype.slice.call(el.querySelectorAll(test),0));
				}else if(el.querySelectorAll){
					potential = Array.prototype.slice.call(el.querySelectorAll(test),0);
				}
				for(var c=0;c<potential.length;c++){
					n = potential[c];
					t = {target: n};
					fs = indx[test].filters;
					for(var filterName in fs){
						tests = fs[filterName];
						for(var i=0;i<tests.length;i++){
							x = filters.map[filterName].fn(n,tests[i].args,{siblings: n.parentNode.children, location: normalizedUrl() });
							(x) ? addMangledClass(t,tests[i].rid) : removeMangledClass(t,tests[i].rid);
						}
					}
				}
			}
		},
		
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
				return compiled_cssplugin_rules;
			},
			
			init: function(){
				var ss, known, temp, real, ns = document.createElement('style'), vendors = "-moz-|-ms-|-webkit-|-o-";
				document.getElementsByTagName('head')[0].appendChild(ns);
				ss = document.styleSheets[document.styleSheets.length-1];
				known = cssPlugins.getPluginNames();
				known.push(vendor);
				known = new RegExp(known.join('|'));
				for(i=0;i<nativeRules.length;i++){
					temp =  nativeRules[i].rule.split(",");
					real = [];
					for(var n=0;n<temp.length;n++){
						real.push(temp[n]);
						if(/-[A-z\0...9]*/.test(temp[n]) && !known.test(temp[n])){
						    real.pop();
						}
					}
					console.log(real.join(','));
					ss.insertRule(real.join(","),ss.length-1);
				}
				testSubtree(document.body,document.head.webkitMatchesSelector);
				document.body.addEventListener('DOMAttrModified',testSubtree);
				document.body.addEventListener('DOMNodeInserted',testSubtree);
				document.body.addEventListener('DOMNodeRemoved',testSubtree);
				document.addEventListener('DOMSubtreeModified',function(t){
					if(!t.target._isSetting && t.target._oldclasses !== t.target.className){
						t.target._isSetting = true;
						t.target.setAttribute('class',t.target.className);
						t.target._oldclasses = t.target.className;
						t.target._isSetting = false;
					}
				});
				
			},
			
			registerFilter: function(alias, base, filter, ancestrallytruthy){
				if(filter){
					filters.map[":" + alias] = {  fn: filter, base: base, ancestrallytruthy: ancestrallytruthy };
				};
			}
		};
		
	// Go!
	var ready = function(){
		var matches;
		if(cssplugin_selectors){
			for(var i=0;i<cssplugin_selectors.length;i++){
				filters.registerFilter(
					cssplugin_selectors[i].name,
					cssplugin_selectors[i].base,
					cssplugin_selectors[i].fn,
					cssplugin_selectors[i].ancestrallytruthy
				);
			};
		
			if(document.body.mozMatchesSelector){ vendor = "-moz-"; matches = 'mozMatchesSelector'; }
			else if(document.body.webkitMatchesSelector){  vendor = "-webkit-"; matches = 'webkitMatchesSelector'; }
			else if(document.body.oMatchesSelector){  vendor = "-o-"; matches = 'oMatchesSelector'; }
			else{ vendor = "-ms-";  matches = 'msMatchesSelector'; } 
			if(!document.head.matchesSelector){
				Element.prototype.matchesSelector = function(s){ 
					return this[matches](s); 
				}
			}
			nativeRules = filters.parseFilters();
			for(var i=0;i<nativeRules.length;i++){
				if(nativeRules[i].segments){
					rulesWeCareAbout.push(nativeRules[i]);
				};
			};
			filters.init();
		};
	};
		
	//TODO: All browsers cool with addEventListener?
	document.addEventListener( "DOMContentLoaded", function(){
		if(defaultInit){
			ready();
		};
	}, false );
		
	return { 
		useManualInit: function(){ defaultInit = false; },
		
		init: function(){
			ready();
		},
		
		addCompiledRules: function(rDescs){
			compiled_cssplugin_rules = compiled_cssplugin_rules.concat(rDescs);
			return this;
		},
		
		addFilters: function(fDescs){
			cssplugin_selectors = cssplugin_selectors.concat(fDescs);
		},
		
		getPluginNames: function(){
			var ret=[], s = cssplugin_selectors.length-1;
			while(s){ ret.push(cssplugin_selectors[s].name); s--; }
			return ret;
		},
		
		getBase: function(p){
			for(var i=0;i<cssplugin_selectors.length;i++){
				if(p===cssplugin_selectors[i].name){
					return cssplugin_selectors[i].base;
				}	
			}
		}
	};
}());