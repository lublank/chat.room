'use strict';

$(function(){

    $('.room-content').on('submit', '#form-room', function(){
        //新增
        var eName = $('input[name="enName"]').val();
        var cName = $('input[name="cnName"]').val();
        $.post('/room/add', {
            eName: eName,
            cName: cName
        }).then(function(res){
            if(res.suc) {
                alert(res.msg);
                location.reload();
            }else {
                alert(res.err);
            }
            return false;
        });
        return false;
    }).on('click', '.delete', function(){
        //删除
        var r = window.confirm('确定要删除该房间吗');
        if(r == true){
            var rid = $(this).data('rid');
            $.post('/room/delete', {
                rid: rid
            }).then(function(res){
                if(res.suc) {
                    alert(res.msg);
                    location.reload();
                }else {
                    alert(res.err);
                }
            });
        }
    });

});
