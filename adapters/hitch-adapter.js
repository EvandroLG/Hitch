cssPlugins.useManualInit();
 $(document).ready(
	function(){ 
		var loads = [], 
			cache;
			
		$('[-plugins-interpret]').each( 
			function(i,el){ 
				var href, 
					deferred = $.Deferred(), 
					initer = function(c){
						cssPlugins.addCompiledRules(c);
						deferred.resolve();
					};
				loads.push(deferred);
				if(el.tagName === 'STYLE'){
					cssPluginsCompiler(el.innerHTML,initer,window.location.path);
				}else{
					href = el.href;
					$.get(href, function(src){
						cssPluginsCompiler(src,initer,href.substring(0,href.lastIndexOf('/'));
					}, 'text');
				}
			}
		);
		$.when.apply($,loads).then(function(){
			cssPlugins.init();
		});
	}
);