var cssPluginsCompiler = function(src,cb,path){
	var inp, 
		raw, 
		rawSelector, 
		nativeRule, 
		pluginsFound, 
		base,  
		li,
		sans,
		promises = [],
		h = document.head,
		matcherFn = h.mozMatchesSelector || h.webkitMatchesSelector || h.msMatchesSelector || h.oMatchesSelector,
		regExpPart = '\\([^\\)]*\\)', 
		care =  /(\[|#|\.|:|\w)[A-z|0-9|\-]*/g,
		compiled = [], 
		mapper = {},
		mc = 0,
		requires = [],
		consts = [],
		any = "-" + matcherFn.name.replace("MatchesSelector", "-any"), 
		src = src.replace(/\@-plugins-const[^\;]*\;/g, function(m,i,s){
			var parts = m.split(/\s|\;/g), name;
			parts.shift();
			name = parts.shift();
			consts[name] = parts.join(' ');
			console.log('defined const ' + name + ' as ' + parts.join(' '));
			cssPlugins.addFilters([{name: name, base: parts.join(' ')}]);
			return '';
		}),
		src = src.replace(/\@-plugins-require[^\;]*\;/g, function(m,i,s){
			var parts = m.split(/\s|\;/g);
			requires.push(parts[1]);
			promises.push(path + $.getScript(parts[1]));
			return '';
		}),
		lastPluginSegment,
		pastLastPluginSegment,
		pluginNames, 
		reHasPlugin, 
		reHasFn, 
		lastComp, 
		doneCb = cb, 
		getSegIndex = function(rulez){
			var ret = [], segs, rule, segment, lastSeg = 0, sans, joint;
				segIndex = {};
				for(var i=0;i<rulez.length;i++){
					rule = rulez[i];
					segs = [];
					if(rule.segments){
						for(var x=0;x<rule.segments.length;x++){						
							segment = rule.segments[x];
							sans = segment.selector.replace(/\._\d/, "").replace(":not()","");
							
							segs.push(sans);
							if(segment.filter){
								joint = segs.join(' ');
								if(joint===""){ joint = "*"; }
								if(!segIndex[joint]){
									segIndex[joint] = { filters: {} };
								}
								if(!segIndex[joint].filters[segment.filter]){
									segIndex[joint].filters[segment.filter] = [];
								}
								segIndex[joint].filters[segment.filter].push({sid: x, rid: i, cid: segment.cid, args: segment.filterargs});
							};
						};
					};
				}
				
			return segIndex;
		};
		for(var constname in consts){
			src = src.replace(constname, consts[constname]);
		};
		$.when.apply($,promises).then(function(){
			var comm;
			pluginNames = cssPlugins.getPluginNames(),
			reHasPlugin = new RegExp(pluginNames.join('|')),
			reHasFn = new RegExp(pluginNames.join(regExpPart + '|') + regExpPart,"g"),
			inp = src.split("}"),
			lastComp = function(){
				return compiled[compiled.length-1];
			};
			
			try{ // oohhh I hate you mobile webkit!  false, false advertizing!
				document.head.querySelectorAll(":" + any + "(*)").length;
				//throw e; // make it work in reg webkit for debugging.
			}catch(e){
				any = "-plugin-any";
			};
			
			for(var i=0;i<inp.length;i++){   // for each rule...
				li = 0;
				raw = inp[i].trim();
				if(raw !== ''){
					raw = inp[i] + "}";
					nativeRule = raw;
					o = raw.split("{");
					rawSelector = o[0]; 
					if(rawSelector !== '*' && reHasPlugin.test(rawSelector)){   // if the rule has a plugin reference									
							comm = "/* was: " + rawSelector.replace(/\/\*.*\*\//g,'').replace(/\n|\t/g,'').trim() + " */\n";
							compiled.push({segments:[],rid: i});
							rawSelector = rawSelector.replace(/\/\*.*\*\//g,'').replace(reHasFn, function(m,i,s){
								var ret, sel;
								//each unique one gets an index
								if(typeof mapper[m] === 'undefined'){
									mapper[m] = { index: mc++, args: m.match(/\((.*)\)/)[1] }; 
								}
								base = cssPlugins.getBase(m.split("(")[0]);
								if(!base || base === ''){
									base = "*";
								};
								if(any === '-plugin-any'){
									ret = '';
									i=i-1;
								}else{					
									ret = any + "(" + base + ")"; 
								};
								if(typeof mapper[m].index !== 'undefined'){
									ret +=  "._" + mapper[m].index;
								};
								sel = (s.substring(li,i) + ret).replace(/\/\*.*\*\//g,'').replace(/[\t|\n]/g,"").trim();
								sel += (/\(\.\_\d$/.test(sel) )  ? ')' : '';
								lastComp().segments.push({
									"selector": sel, 
									"filter":   ":"+ m.split("(")[0],
									"filterargs": mapper[m].args, 
									"cid": mapper[m].index
								});
								return ret;
							});
							rawSelector = rawSelector.trim().replace(/:$/, "").replace(":._","._");
							pluginsFound = rawSelector.match(reHasPlugin);  
							if(pluginsFound){
								for(var x=0;x<pluginsFound.length;x++){
									base = cssPlugins.getBase(pluginsFound[x]);
									//stragglers...
									rawSelector = rawSelector.replace(new RegExp(":" + pluginsFound[x],"g"),function(){
										return base || '';
									});
								};
							};	
							
							if(lastComp().segments.length === 0){
								delete lastComp().segments;  
							}else{
								var lastPluginSegment = lastComp().segments[lastComp().segments.length-1];
								var pastLastPluginSegment = rawSelector.substring(rawSelector.indexOf(lastPluginSegment.selector)  + lastPluginSegment.selector.length ).trim();
								if(pastLastPluginSegment!=='' && pastLastPluginSegment!==')'){
									lastComp().segments.push({"selector": pastLastPluginSegment});
								}
							};
							sans = rawSelector.match(care);
							for(var x=sans.length-1;x>=0;x--){
								if(sans[x][0]===':'){
									sans.splice(x,1);  // get rid of these, need a better regex...
								}
							};
							lastComp().rule = comm + rawSelector.trim() + "{" + o[1];
					}else{
						compiled.push({rule:  raw, rid: i });
					};
					
				};
			};
			
			/* TODO: temporarily doing extra work to fix the model contract */
			var outModel = { rules: [], segIndex: getSegIndex(compiled), plugins: requires };			
			for(var ccc=0; ccc < compiled.length; ccc++){
				outModel.rules.push(compiled[ccc].rule);
			}
			doneCb(outModel);
	});
}

if(typeof module !== 'undefined' && module.exports){
	module.exports = cssPluginsCompiler;
}