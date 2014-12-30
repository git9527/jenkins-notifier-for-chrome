$(function() {
	
	restore();
	
    function eachField(f) {
        $(".text").each(function(_, elem) {
            var elem = $(elem);
            f(elem);
        });
    }

    function restore() {
        eachField(function(elem) {
            var name = elem.attr("name");
            elem.attr( "value", localStorage[name]);
        });

        if(localStorage['notify-only-fail'] == 'true') {
            $("#notify-only-fail").attr("checked","checked");
        }else{
            $("#notify-only-fail").removeAttr("checked");
        }
    }
    
    function save() {
        eachField(function(elem) {
            var name = elem.attr("name");
            localStorage[name] = elem.attr("value");
        })
        localStorage['notify-only-fail'] = $("#notify-only-fail").attr("checked") ? 'true' : 'false';
        console.info("init success!");
        chrome.extension.getBackgroundPage().window.location.reload();
    }

    $(".save").bind("click", function(e) {
        e.preventDefault();
        save();
        window.close();
    });

    $("#form").bind("submit", function(e) {
        window.close();
    });
});
