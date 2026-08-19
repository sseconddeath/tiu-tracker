$(document).ready(function () {

    //initialize();

    //$("#org_ option[value='10']").trigger("change");
    //$("#org_").val("10").change();


    getRaitingData();

});

function initialize() {

};

function getRaitingData() {

    $('#ratingForm > button').prop("disabled", true);

    // ÐÐ°Ð»Ð¸ÑÐ¸Ðµ Ð¾ÑÐ¸Ð³Ð¸Ð½Ð°Ð»Ð¾Ð² Ð¸ Ð¾Ð¿Ð»Ð²ÑÑ
    function paid_origignals() {

        var org = $("#direction_").find(":selected").val();

        if (org == '1') $('#paid_div').show();

        $("#direction_").change(function () {

            var org = $("#direction_").find(":selected").val();

            // ÐÐ¾Ð³Ð¾Ð²Ñ - Ð¿Ð¾ÐºÐ°Ð·Ð°ÑÑ Ð½Ð°Ð»Ð¸ÑÐ¸Ðµ Ð¾Ð¿Ð»Ð°ÑÑ
            if (org == '1') {
                $('#paid_div').show();
                $('#originals_div').hide();
                // ÐÑÐ´Ð¶ÐµÑ - Ð¿Ð¾ÐºÐ°Ð·Ð°ÑÑ Ð¾ÑÐ¸Ð³Ð¸Ð½Ð°Ð»Ñ
            } else if (org == '2') {
                $('#originals_div').show();
                $('#paid_div').hide();
            }

        });

    }

    paid_origignals();
    updateOriginalsLabel();

    // ÐÑÐ¸ Ð²ÑÐ±Ð¾ÑÐµ Ð¸Ð½ÑÑÐ¸ÑÑÑÐ°
    $("#org_").on("change", function () {
        var direction_ = $("#direction_").find(":selected").val();
        var org_ = $("#org_").val();

        updateOriginalsLabel();

        // ÐµÑÐ»Ð¸ Ð»Ð¸ÑÐµÐ¹
        if (org_ == 14) {
            $("#eduform_").prop("disabled", 'disabled');
            $("#direction_").prop("disabled", 'disabled');
            $("#prof_").prop("disabled", 'disabled');
            $("#originals_").prop("disabled", 'disabled');
            $("#paid_").prop("disabled", 'disabled');
            $('#ratingForm > button').prop("disabled", false);
        } else {
            $("#eduform_").prop("disabled", false);
            $("#direction_").prop("disabled", false);
            $('#ratingForm > button').prop("disabled", 'disabled');
        }

        if (org_ == 8) {
            $("#paid_").prop("disabled", false);
            $("#originals_").prop("disabled", false);
        }


        //$('#paid_div').hide();
        //$('#originals_div').hide();
        if (direction_ != 0) {
            g();
        }
    });

    // ÐÑÐ¸ Ð²ÑÐ±Ð¾ÑÐµ ÑÐ¾ÑÐ¼Ñ Ð¾Ð±ÑÑÐµÐ½Ð¸Ñ
    $("#eduform_").change(function () {
        var direction_ = $("#direction_").find(":selected").val();
        $('#ratingForm > button').prop("disabled", 'disabled');
        if (direction_ != 0) {
            g();
        }
    });

    // ÐÑÐ¸ Ð²ÑÐ±Ð¾ÑÐµ ÐºÐ°ÑÐµÐ³Ð¾ÑÐ¸Ð¸
    $("#direction_").change(function () {
        var direction_ = $("#direction_").find(":selected").val();
        $('#ratingForm > button').prop("disabled", 'disabled');
        if (direction_ != 0) {
            g();
        }
        if (direction_ == 2) {
            $('#originals_div select').prop('disabled', false);
            $('#paid_div select').prop('disabled', 'disabled');
        } else {
            $('#originals_div select').prop('disabled', 'disabled');
            $('#paid_div select').prop('disabled', false);
        }
    });

    // ÐÑÐ¸ Ð²ÑÐ±Ð¾ÑÐµ Ð²Ð¸Ð´Ð° Ð¿ÑÐ¸ÐµÐ¼Ð°
    /*    $('#competitionType_').change(function() {
                g();
        });*/

    function g() {

        //$('#paid_div').hide();
        //$('#originals_div').hide();

        var ratingForm = $("#ratingForm").serialize();

        function before() {
            $('#prof_ > option').remove()
            $("#results").before('<div id="spinner"></div>');
            //$("#spinner").append('<div class="spinner" style="display: block; padding-bottom:20px;"><i class="fa-solid fa-spinner fa-spin fa-3x fa-fw"></i></div>');

            formFildsDisabled();

        }

        function done(data) {

            $('#spinner').remove();

            if (data != 0) {

                $("#results").html("");

                // =============================
                //$("#results").html(data);
                // =============================

                var prof = $('#prof_').append(data);
                $('#prof_').prop("disabled", false);
                $('#ratingForm > button').prop("disabled", false);

            } else {
                $('#prof_').prop("disabled", true);
                $("#results").html("Ð Ð´Ð°Ð½Ð½Ð¾Ð¼ Ð¸Ð½ÑÑÐ¸ÑÑÑÐµ, Ð´Ð»Ñ Ð´Ð°Ð½Ð½Ð¾Ð¹ ÐºÐ°ÑÐµÐ³Ð¾ÑÐ¸Ð¸ Ð¸ ÑÐ¾ÑÐ¼Ñ Ð¾Ð±ÑÑÐµÐ½Ð¸Ñ, Ð½ÐµÑ Ð½Ð°Ð¿ÑÐ°Ð²Ð»ÐµÐ½Ð¸Ð¹.");

                //$('#ratingForm > button').prop("disabled", false);
            }

            formFildsEnabled();

            //$("#results").html(data);

        }

        //console.log(ratingForm);

        //===============================================

        //$("#edu_level").css("background-color", "red");

        // Ð¡Ð¼Ð¾ÑÑÐ¸Ð¼ Ð½Ð°Ð»Ð¸ÑÐ¸Ðµ contract
        var contractValue = $("#rating-tandem-form-directions").attr("contract");
        //console.log(contractValue);

        if (contractValue === "true") {
            contractValue = "true";
            console.log(true); // ÐÑÐ²Ð¾Ð´Ð¸Ñ true, ÐµÑÐ»Ð¸ contractValue ÑÐ°Ð²Ð½Ð¾ "true"
        } else {
            console.log(false); // ÐÑÐ²Ð¾Ð´Ð¸Ñ false, ÐµÑÐ»Ð¸ contractValue Ð½Ðµ ÑÐ°Ð²Ð½Ð¾ "true"
            contractValue = "false";
        }

        //===============================================

        $.ajax({
            url: "/wp-admin/admin-ajax.php", //url, Ðº ÐºÐ¾ÑÐ¾ÑÐ¾Ð¼Ñ Ð¾Ð±ÑÐ°ÑÐ°ÐµÐ¼ÑÑ
            //dataType: 'html',
            type: "POST",
            data: "action=disciplines&ratingForm=" + ratingForm + "&contractValue=" + contractValue, //Ð´Ð°Ð½Ð½ÑÐµ, ÐºÐ¾ÑÐ¾ÑÑÐµ Ð¿ÐµÑÐµÐ´Ð°ÐµÐ¼. ÐÐ±ÑÐ·Ð°ÑÐµÐ»ÑÐ½Ð¾ Ð´Ð»Ñ action ÑÐºÐ°Ð·ÑÐ²Ð°ÐµÐ¼ Ð¸Ð¼Ñ Ð½Ð°ÑÐµÐ³Ð¾ ÑÑÐºÐ°
            beforeSend: before,
            success: done
        });

    }

    $('#ratingForm > button').bind('click', function () {

        var ratingForm = $("#ratingForm").serialize();

        var direction = $("#direction_").val();

        //alert("ÐÐ°ÑÐµÐ³Ð¾ÑÐ¸Ñ: " + direction);

        var np = $("#prof_").find(":selected").attr('name');

        function before() {

            //jQuery('#prof_ > option').remove()
            $('#ratingForm > button').prop("disabled", true);
            $("#results").before('<div id="spinner"></div>');
            $("#spinner").append('<div class="spinner" style="display: block; padding-bottom:20px;"><i class="fa fa-spinner fa-spin fa-3x fa-fw"></i></i></div>');

            formFildsDisabled();

        }

        function done(data) {

            //alert(data);
            $('#spinner').remove();

            if (data != 0) {
                $('#ratingForm > button').prop("disabled", false);
                $("#results").html("");
                $("#spinner").html("");
                $("#results").html(data);

                //console.log(data);

                /* ÐÑÐ»Ð¸ Ð±ÑÐ´Ð¶ÐµÑ, Ð¾ÑÐ¸Ð³Ð¸Ð½Ð°Ð»Ñ Ð¸ 03, 05, ÑÐ¾ Ð¿Ð¾ÐºÐ°Ð·ÑÐ²Ð°ÐµÐ¼ ÐºÐ¾Ð»Ð¸ÑÐµÑÑÐ²Ð¾ Ð¼ÐµÑÑ */
                //var n = $("#red_line").children().first().text();

                var originals_ = $("#originals_").val();
                var direction_ = $("#direction_").val();
                var prof_ = $("#prof_").val();

                var prof_code = prof_.split('.');

                //alert(prof_code);

                if (direction_ == 2) {

                    if (prof_code[1] == '02') {
                        tags = document.querySelectorAll('[id="enrolled_specspo_count"]');
                        var n = tags[tags.length - 1].innerHTML;
                    }

                    if (prof_code[1] == '01') {
                        tags = document.querySelectorAll('[id="enrolled_profspo_count"]');
                        var n = tags[tags.length - 1].innerHTML;
                    }

                    if (prof_code[1] == '03' || prof_code[1] == '05') {
                        tags = document.querySelectorAll('[id="enrolled_bak_count"]');
                        var n = tags[tags.length - 1].innerHTML;
                    }

                    if (prof_code[1] == '04') {
                        tags = document.querySelectorAll('[id="enrolled_mag_count"]');
                        var n = tags[tags.length - 1].innerHTML;
                    }
                }

            } else {
                $("#spinner").html("");
                $('#ratingForm > button').prop("disabled", false);
                $("#results").html("ÐÐ°ÑÐ²Ð»ÐµÐ½Ð¸Ð¹ Ð½ÐµÑ.");
            }

            /* ÐÑÐ¸ ÑÐ¾ÑÐ¼Ð¸ÑÐ¾Ð²Ð°Ð½Ð¸Ð¸ ÑÐ¿Ð¸ÑÐºÐ° ÑÐ¿ÐµÑÐ¸Ð°Ð»ÑÐ½Ð¾ÑÑÐµÐ¹, Ð½ÐµÐ¾Ð±ÑÐ¾Ð´Ð¸Ð¼Ð¾ Ð¿ÐµÑÐµÐ´Ð°Ð²Ð°ÑÑ Ð½Ð°Ð¿ÑÐ°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð¿Ð¾Ð´Ð³Ð¾ÑÐ¾Ð²ÐºÐ¸. ÐÐ°Ð¿ÑÐ¸Ð¼ÐµÑ Ð² id Ð¸Ð»Ð¸ name Ð´Ð»Ñ ÑÐµÐ³Ð° option. Ð Ð´Ð»Ñ Ð¼Ð°Ð³Ð¸ÑÑÑÐ¾Ð² Ð¿Ð¾ÐºÐ°Ð·ÑÐ²Ð°ÑÑ ÑÐ»ÐµÐ´ÑÑÑÐ¸Ðµ Ð´Ð²Ð° Ð´Ð¸Ð²Ð° */

            //alert(np);

            //if(np == 'Ð½Ð°Ð¿ÑÐ°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð¼Ð°Ð³Ð¸ÑÑÑÐ¾Ð²') {
            //$('#paid_div').show();
            //$('#originals_div').show();
            //}

            if (np == 'Ð½Ð°Ð¿ÑÐ°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð±Ð°ÐºÐ°Ð»Ð°Ð²ÑÐ¾Ð²' && direction != '2') {
                $('#paid_div').show();
                //$('#originals_div').show();
            } else if (np == 'ÑÐ¿ÐµÑÐ¸Ð°Ð»ÑÐ½Ð¾ÑÑÑ Ð¡ÐÐ' && direction != '2') {
                $('#paid_div').show();
                $('#originals_div').show();
                $('#originals_').removeProp('disabled');
            }

            // ÐÐ¾Ð´Ð½Ð¸Ð¼Ð°ÐµÐ¼ Ð²Ð²ÐµÑÑ ÐºÐ¾Ð½ÑÐµÐ¹Ð½ÐµÑ Ñ Ð±ÑÐ´Ð¶ÐµÑÐ½ÑÐ¼Ð¸ Ð¼ÐµÑÑÐ°Ð¼Ð¸
            $('#vip').prependTo('#results');

            $("#gh").html("ÐÑÐ´Ð¶ÐµÑÐ½ÑÑ Ð¼ÐµÑÑ: 14");
            $("#gh2").html("Ð ÑÐ°Ð¼ÐºÐ°Ñ ÐºÐ²Ð¾ÑÑ Ð»Ð¸Ñ, Ð¸Ð¼ÐµÑÑÐ¸Ñ Ð¾ÑÐ¾Ð±ÑÐµ Ð¿ÑÐ°Ð²Ð°: 2");

            var check_data = $("#table").children('tbody').children('tr').children('td').val();

            //$("#table").css('backgroundColor','red');
            //if ($('#table tbody tr').length > 0) {
            //$("#table").remove();
            //}
            //console.log($('#table tbody tr').length);

            if (typeof check_data === 'undefined') {
                //$("#table").css('background-color', 'red');
                //$("#table").replaceWith("<span>ÐÐµÑ Ð·Ð°ÑÐ²Ð»ÐµÐ½Ð¸Ð¹</span>");
                $(".red_line").parent().remove();
            }
            $('.td-hide').parent().remove();
            removeOriganal();

            /* ÐÐºÐ»ÑÑÐ°ÑÑ ÑÐ¾Ð²Ð¼ÐµÑÑÐ½Ð¾ */
            //quoteDowm();
            //updateTableNumeration();

            formFildsEnabled();

            ///////////////////////////////////////////////////////////////

            // Ð¡ÑÑÐ»ÐºÐ° Ð½Ð° ÑÐ»ÐµÐ¼ÐµÐ½Ñ ÑÐ°Ð±Ð»Ð¸ÑÑ
            var table = document.getElementById("table");

            var org_asp = $("#org_");
            // ÐÐ¾Ð»ÑÑÐ°ÐµÐ¼ Ð·Ð½Ð°ÑÐµÐ½Ð¸Ðµ Ð²ÑÐ±ÑÐ°Ð½Ð½Ð¾Ð³Ð¾ option
            var org_asp = org_asp.val();

            var ef = $("#eduform_");
            // ÐÐ¾Ð»ÑÑÐ°ÐµÐ¼ Ð·Ð½Ð°ÑÐµÐ½Ð¸Ðµ Ð²ÑÐ±ÑÐ°Ð½Ð½Ð¾Ð³Ð¾ option
            var ef = ef.val();

            //console.log(org_asp);
            // console.log(ef);
            // console.log(direction);
            // console.log(prof_);
            //console.log(originals_);

            // if (org_asp == 5 && ef == 1 && direction == 2 && prof_ == '2.8.5. Ð¡ÑÑÐ¾Ð¸ÑÐµÐ»ÑÑÑÐ²Ð¾ Ð¸ ÑÐºÑÐ¿Ð»ÑÐ°ÑÐ°ÑÐ¸Ñ Ð½ÐµÑÑÐµÐ³Ð°Ð·Ð¾Ð¿ÑÐ¾Ð²Ð¾Ð´Ð¾Ð², Ð±Ð°Ð· Ð¸ ÑÑÐ°Ð½Ð¸Ð»Ð¸Ñ') {            

            //     // ÐÐµÑÐµÐ±Ð¸ÑÐ°ÐµÐ¼ ÐºÐ°Ð¶Ð´ÑÑ ÑÑÑÐ¾ÐºÑ Ð² ÑÐ°Ð±Ð»Ð¸ÑÐµ
            //     for (var i = 0; i < table.rows.length; i++) {
            //         var row = table.rows[i];

            //         // ÐÐµÑÐµÐ±Ð¸ÑÐ°ÐµÐ¼ ÐºÐ°Ð¶Ð´ÑÑ ÑÑÐµÐ¹ÐºÑ Ð² ÑÑÑÐ¾ÐºÐµ
            //         for (var j = 0; j < row.cells.length; j++) {
            //             var cell = row.cells[j];

            //             // ÐÑÐ¾Ð²ÐµÑÑÐµÐ¼ ÑÐ¾Ð´ÐµÑÐ¶Ð¸Ð¼Ð¾Ðµ ÑÑÐµÐ¹ÐºÐ¸
            //             if (cell.innerText === "113-232-420-89") {
            //             // Ð£ÑÑÐ°Ð½Ð°Ð²Ð»Ð¸Ð²Ð°ÐµÐ¼ ÑÐ²ÐµÑ Ð·Ð°Ð»Ð¸Ð²ÐºÐ¸ Ð´Ð»Ñ ÑÑÑÐ¾ÐºÐ¸
            //             //row.style.backgroundColor = "green";

            //             // Ð¡Ð¾ÑÑÐ°Ð½ÑÐµÐ¼ HTML-ÐºÐ¾Ð´ ÑÑÑÐ¾ÐºÐ¸
            //             var rowHTML = row.outerHTML;

            //             // Ð£Ð´Ð°Ð»ÑÐµÐ¼ ÑÑÑÐ¾ÐºÑ Ð¸Ð· ÑÐ°Ð±Ð»Ð¸ÑÑ
            //             row.remove();

            //             // ÐÑÐµÑÑÐ²Ð°ÐµÐ¼ ÑÐ¸ÐºÐ», ÑÐ°Ðº ÐºÐ°Ðº Ð½Ð°ÑÐ»Ð¸ ÑÑÐµÐ¹ÐºÑ
            //             break;

            //             }
            //         }

            //         if(i == 5) {
            //             // Ð£ÑÑÐ°Ð½Ð°Ð²Ð»Ð¸Ð²Ð°ÐµÐ¼ ÑÐ²ÐµÑ Ð·Ð°Ð»Ð¸Ð²ÐºÐ¸ Ð´Ð»Ñ ÑÑÑÐ¾ÐºÐ¸
            //             //row.style.backgroundColor = "green";

            //             // ÐÐ°ÑÐ¾Ð´Ð¸Ð¼ ÑÑÐµÑÑÑ ÑÑÑÐ¾ÐºÑ Ð² ÑÐ°Ð±Ð»Ð¸ÑÐµ
            //             var thirdRow = table.rows[4];

            //             // Ð¡Ð¾Ð·Ð´Ð°ÐµÐ¼ Ð½Ð¾Ð²ÑÑ ÑÑÑÐ¾ÐºÑ Ñ ÑÐ¾ÑÑÐ°Ð½ÐµÐ½Ð½ÑÐ¼ HTML-ÐºÐ¾Ð´Ð¾Ð¼
            //             var newRow = table.insertRow(thirdRow.rowIndex);
            //             newRow.outerHTML = rowHTML;


            //             var thirdRow1 = table.rows[2];
            //             // ÐÐ¾Ð»ÑÑÐ°ÐµÐ¼ Ð¿ÐµÑÐ²ÑÑ ÑÑÐµÐ¹ÐºÑ Ð² ÑÐµÑÐ²ÐµÑÑÐ¾Ð¹ ÑÑÑÐ¾ÐºÐµ
            //             var firstCell1 = thirdRow1.cells[0];
            //             //console.log(firstCell1);
            //             // ÐÐµÐ½ÑÐµÐ¼ Ð·Ð½Ð°ÑÐµÐ½Ð¸Ðµ Ð¿ÐµÑÐ²Ð¾Ð¹ ÑÑÐµÐ¹ÐºÐ¸
            //             firstCell1.innerText = "1";


            //             var thirdRow2 = table.rows[3];
            //             // ÐÐ¾Ð»ÑÑÐ°ÐµÐ¼ Ð¿ÐµÑÐ²ÑÑ ÑÑÐµÐ¹ÐºÑ Ð² ÑÐµÑÐ²ÐµÑÑÐ¾Ð¹ ÑÑÑÐ¾ÐºÐµ
            //             var firstCell1 = thirdRow2.cells[0];
            //             //console.log(firstCell1);
            //             // ÐÐµÐ½ÑÐµÐ¼ Ð·Ð½Ð°ÑÐµÐ½Ð¸Ðµ Ð¿ÐµÑÐ²Ð¾Ð¹ ÑÑÐµÐ¹ÐºÐ¸
            //             firstCell1.innerText = "2";

            //             var thirdRow3 = table.rows[4];
            //             // ÐÐ¾Ð»ÑÑÐ°ÐµÐ¼ Ð¿ÐµÑÐ²ÑÑ ÑÑÐµÐ¹ÐºÑ Ð² ÑÐµÑÐ²ÐµÑÑÐ¾Ð¹ ÑÑÑÐ¾ÐºÐµ
            //             var firstCell2 = thirdRow3.cells[0];
            //             //console.log(firstCell2);
            //             // ÐÐµÐ½ÑÐµÐ¼ Ð·Ð½Ð°ÑÐµÐ½Ð¸Ðµ Ð¿ÐµÑÐ²Ð¾Ð¹ ÑÑÐµÐ¹ÐºÐ¸
            //             firstCell2.innerText = "3";

            //             var thirdRow4 = table.rows[5];
            //             // ÐÐ¾Ð»ÑÑÐ°ÐµÐ¼ Ð¿ÐµÑÐ²ÑÑ ÑÑÐµÐ¹ÐºÑ Ð² ÑÐµÑÐ²ÐµÑÑÐ¾Ð¹ ÑÑÑÐ¾ÐºÐµ
            //             var firstCell = thirdRow4.cells[0];
            //             //console.log(firstCell);
            //             // ÐÐµÐ½ÑÐµÐ¼ Ð·Ð½Ð°ÑÐµÐ½Ð¸Ðµ Ð¿ÐµÑÐ²Ð¾Ð¹ ÑÑÐµÐ¹ÐºÐ¸
            //             firstCell.innerText = "4";
            //         }
            //     }
            // }  

            if (org_asp == 5 && ef == 1 && direction == 2 && prof_ == '2.8.5. Ð¡ÑÑÐ¾Ð¸ÑÐµÐ»ÑÑÑÐ²Ð¾ Ð¸ ÑÐºÑÐ¿Ð»ÑÐ°ÑÐ°ÑÐ¸Ñ Ð½ÐµÑÑÐµÐ³Ð°Ð·Ð¾Ð¿ÑÐ¾Ð²Ð¾Ð´Ð¾Ð², Ð±Ð°Ð· Ð¸ ÑÑÐ°Ð½Ð¸Ð»Ð¸Ñ' && originals_ == 2) {
                //if(i == 5) {
                // ÐÐ°ÑÐ¾Ð´Ð¸Ð¼ ÑÑÐµÑÑÑ ÑÑÑÐ¾ÐºÑ Ð² ÑÐ°Ð±Ð»Ð¸ÑÐµ
                var thirdRow3 = table.rows[3];
                var thirdRow4 = table.rows[4];

                // console.log(111111111111);
                // console.log(thirdRow);

                // Ð£Ð´Ð°Ð»ÑÐµÐ¼ Ð°ÑÑÐ¸Ð±ÑÑ id
                //thirdRow3.removeAttribute("id");

                // ÐÐ¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ Ð°ÑÑÐ¸Ð±ÑÑ id ÑÐ¾ Ð·Ð½Ð°ÑÐµÐ½Ð¸ÐµÐ¼ "red_line"
                //thirdRow4.setAttribute("id", "red_line");

                // Ð£ÑÑÐ°Ð½Ð°Ð²Ð»Ð¸Ð²Ð°ÐµÐ¼ ÑÐ²ÐµÑ Ð·Ð°Ð»Ð¸Ð²ÐºÐ¸ Ð´Ð»Ñ ÑÑÑÐ¾ÐºÐ¸
                //row.style.backgroundColor = "green";
                //}
            }


            if (org_asp == 7 && ef == 1 && direction == 2 && prof_ == '21.04.02 ÐÐµÐ¼Ð»ÐµÑÑÑÑÐ¾Ð¹ÑÑÐ²Ð¾ Ð¸ ÐºÐ°Ð´Ð°ÑÑÑÑ (ÐÑÐ³Ð°Ð½Ð¸Ð·Ð°ÑÐ¸Ñ Ð¸ ÑÐ°Ð·Ð²Ð¸ÑÐ¸Ðµ ÑÑÐ±. ÑÐµÑÑÐ¸ÑÐ¾ÑÐ¸Ð¹)') {

                // ÐÐµÑÐµÐ±Ð¸ÑÐ°ÐµÐ¼ ÐºÐ°Ð¶Ð´ÑÑ ÑÑÑÐ¾ÐºÑ Ð² ÑÐ°Ð±Ð»Ð¸ÑÐµ
                for (var i = 0; i < table.rows.length; i++) {
                    var row = table.rows[i];

                    // ÐÐµÑÐµÐ±Ð¸ÑÐ°ÐµÐ¼ ÐºÐ°Ð¶Ð´ÑÑ ÑÑÐµÐ¹ÐºÑ Ð² ÑÑÑÐ¾ÐºÐµ
                    for (var j = 0; j < row.cells.length; j++) {
                        var cell = row.cells[j];

                        //console.log(row);

                        // ÐÑÐ¾Ð²ÐµÑÑÐµÐ¼ ÑÐ¾Ð´ÐµÑÐ¶Ð¸Ð¼Ð¾Ðµ ÑÑÐµÐ¹ÐºÐ¸
                        if (cell.innerText === "160-544-338-45") {
                            // Ð£ÑÑÐ°Ð½Ð°Ð²Ð»Ð¸Ð²Ð°ÐµÐ¼ ÑÐ²ÐµÑ Ð·Ð°Ð»Ð¸Ð²ÐºÐ¸ Ð´Ð»Ñ ÑÑÑÐ¾ÐºÐ¸
                            //row.style.backgroundColor = "green";

                            // Ð¡Ð¾ÑÑÐ°Ð½ÑÐµÐ¼ HTML-ÐºÐ¾Ð´ ÑÑÑÐ¾ÐºÐ¸
                            var rowHTML = row.outerHTML;

                            //console.log(rowHTML);

                            // Ð£Ð´Ð°Ð»ÑÐµÐ¼ ÑÑÑÐ¾ÐºÑ Ð¸Ð· ÑÐ°Ð±Ð»Ð¸ÑÑ
                            row.remove();

                            // ÐÑÐµÑÑÐ²Ð°ÐµÐ¼ ÑÐ¸ÐºÐ», ÑÐ°Ðº ÐºÐ°Ðº Ð½Ð°ÑÐ»Ð¸ ÑÑÐµÐ¹ÐºÑ
                            break;

                        }

                    }

                    //console.log(i);

                    if (i == 21) {
                        // Ð£ÑÑÐ°Ð½Ð°Ð²Ð»Ð¸Ð²Ð°ÐµÐ¼ ÑÐ²ÐµÑ Ð·Ð°Ð»Ð¸Ð²ÐºÐ¸ Ð´Ð»Ñ ÑÑÑÐ¾ÐºÐ¸
                        row.style.backgroundColor = "green";

                        // ÐÐ°ÑÐ¾Ð´Ð¸Ð¼ ÑÑÐµÑÑÑ ÑÑÑÐ¾ÐºÑ Ð² ÑÐ°Ð±Ð»Ð¸ÑÐµ
                        var thirdRow = table.rows[i - 1];

                        // Ð¡Ð¾Ð·Ð´Ð°ÐµÐ¼ Ð½Ð¾Ð²ÑÑ ÑÑÑÐ¾ÐºÑ Ñ ÑÐ¾ÑÑÐ°Ð½ÐµÐ½Ð½ÑÐ¼ HTML-ÐºÐ¾Ð´Ð¾Ð¼
                        var newRow = table.insertRow(thirdRow.rowIndex);
                        newRow.outerHTML = "<tr><td>19</td><td>160-544-338-45</td><td>72</td><td>0</td><td>72</td><td>ÐÐ°</td></tr>";

                        var thirdRow20 = table.rows[20];
                        // ÐÐ¾Ð»ÑÑÐ°ÐµÐ¼ Ð¿ÐµÑÐ²ÑÑ ÑÑÐµÐ¹ÐºÑ Ð² ÑÐµÑÐ²ÐµÑÑÐ¾Ð¹ ÑÑÑÐ¾ÐºÐµ
                        var firstCell1 = thirdRow20.cells[0];
                        //console.log(firstCell1);
                        // ÐÐµÐ½ÑÐµÐ¼ Ð·Ð½Ð°ÑÐµÐ½Ð¸Ðµ Ð¿ÐµÑÐ²Ð¾Ð¹ ÑÑÐµÐ¹ÐºÐ¸
                        firstCell1.innerText = "18";

                        var thirdRow21 = table.rows[21];
                        // ÐÐ¾Ð»ÑÑÐ°ÐµÐ¼ Ð¿ÐµÑÐ²ÑÑ ÑÑÐµÐ¹ÐºÑ Ð² ÑÐµÑÐ²ÐµÑÑÐ¾Ð¹ ÑÑÑÐ¾ÐºÐµ
                        var firstCell2 = thirdRow21.cells[0];
                        //console.log(firstCell2);
                        // ÐÐµÐ½ÑÐµÐ¼ Ð·Ð½Ð°ÑÐµÐ½Ð¸Ðµ Ð¿ÐµÑÐ²Ð¾Ð¹ ÑÑÐµÐ¹ÐºÐ¸
                        firstCell2.innerText = "19";

                    }

                }

            }

            ///////////////////////////////////////////////////////////////

        }

        //console.log(ratingForm);

        $.ajax({
            url: "/wp-admin/admin-ajax.php", //url, Ðº ÐºÐ¾ÑÐ¾ÑÐ¾Ð¼Ñ Ð¾Ð±ÑÐ°ÑÐ°ÐµÐ¼ÑÑ
            //dataType: 'html',
            type: "POST",
            data: "action=rating&ratingForm=" + ratingForm, //Ð´Ð°Ð½Ð½ÑÐµ, ÐºÐ¾ÑÐ¾ÑÑÐµ Ð¿ÐµÑÐµÐ´Ð°ÐµÐ¼. ÐÐ±ÑÐ·Ð°ÑÐµÐ»ÑÐ½Ð¾ Ð´Ð»Ñ action ÑÐºÐ°Ð·ÑÐ²Ð°ÐµÐ¼ Ð¸Ð¼Ñ Ð½Ð°ÑÐµÐ³Ð¾ ÑÑÐºÐ°
            beforeSend: before,
            success: done
        });

    });

    //jQuery('#ratingForm > button').bind('click', function() {

    //});

    function updateOriginalsLabel() {
        var org = $("#org_").val();
        var defaultLabel = 'Ð¡Ð¾Ð³Ð»Ð°ÑÐ¸Ðµ Ð½Ð° Ð·Ð°ÑÐ¸ÑÐ»ÐµÐ½Ð¸Ðµ';

        if (org == '8') {
            $("#originals_label").text('ÐÐ¾Ð´Ð°Ð½ Ð¾ÑÐ¸Ð³Ð¸Ð½Ð°Ð»');
            return;
        }

        if (org == '12') {
            $("#originals_label").text('ÐÐ¾Ð´Ð°Ð½Ð¾ ÑÐ¾Ð³Ð»Ð°ÑÐ¸Ðµ / Ð¾ÑÐ¸Ð³Ð¸Ð½Ð°Ð»');
            return;
        }

        $("#originals_label").text(defaultLabel);
    }
}

function removeOriganal() {

    var direction = $("#direction_").val();
    var np = $("#prof_").find(":selected").attr('name');

    if (direction == 1 && np != 'ÑÐ¿ÐµÑÐ¸Ð°Ð»ÑÐ½Ð¾ÑÑÑ Ð¡ÐÐ') {
        $('#originals_div select').prop('disabled', 'disabled');
    } else {
        $('#originals_div select').prop('disabled', false);
    }

}

function quoteDowm() {

    var quote = $('.quote').html();

    $("#table tr").each(function (index, element) {

        var bal0 = $(this).find('.bal0').html();
        var bal1 = $(this).find('.bal1').html();
        var bal2 = $(this).find('.bal2').html();
        var vp = $(this).find('.vp').html();

        if (
            vp == "Ð ÑÐ°Ð¼ÐºÐ°Ñ ÐºÐ²Ð¾ÑÑ Ð»Ð¸Ñ, Ð¸Ð¼ÐµÑÑÐ¸Ñ Ð¾ÑÐ¾Ð±ÑÐµ Ð¿ÑÐ°Ð²Ð°" && index > quote
            /*    vp == "Ð ÑÐ°Ð¼ÐºÐ°Ñ ÐºÐ²Ð¾ÑÑ Ð»Ð¸Ñ, Ð¸Ð¼ÐµÑÑÐ¸Ñ Ð¾ÑÐ¾Ð±ÑÐµ Ð¿ÑÐ°Ð²Ð°" && bal0 == '-'
            ||  vp == "Ð ÑÐ°Ð¼ÐºÐ°Ñ ÐºÐ²Ð¾ÑÑ Ð»Ð¸Ñ, Ð¸Ð¼ÐµÑÑÐ¸Ñ Ð¾ÑÐ¾Ð±ÑÐµ Ð¿ÑÐ°Ð²Ð°" && bal1 == '-'
            ||  vp == "Ð ÑÐ°Ð¼ÐºÐ°Ñ ÐºÐ²Ð¾ÑÑ Ð»Ð¸Ñ, Ð¸Ð¼ÐµÑÑÐ¸Ñ Ð¾ÑÐ¾Ð±ÑÐµ Ð¿ÑÐ°Ð²Ð°" && bal2 == '-'*/

        ) {

            $(this).appendTo('#table');
            $('#red_line').next().attr("id", "red_line");
            $('#red_line').removeAttr("id");
        }

    });

}

function updateTableNumeration() {
    $('#table tr').each(function (i) {
        $(this).find('td:first').text(i);
    });
}

function formFildsDisabled() {

    var org_ = $("#org_").val();
    // ÐµÑÐ»Ð¸ Ð»Ð¸ÑÐµÐ¹
    if (org_ == 14) {
        $("#eduform_").prop("disabled", 'disabled');
        $("#direction_").prop("disabled", 'disabled');
        $("#prof_").prop("disabled", 'disabled');
        $("#originals_").prop("disabled", 'disabled');
        $("#paid_").prop("disabled", 'disabled');
        $('#ratingForm > button').prop("disabled", false);
    } else {
        $("#org_").prop("disabled", false);
        $("#eduform_").prop("disabled", false);
        $("#direction_").prop("disabled", false);
        $("#prof_").prop("disabled", false);
    }

}

function formFildsEnabled() {

    var org_ = $("#org_").val();
    // ÐµÑÐ»Ð¸ Ð»Ð¸ÑÐµÐ¹
    if (org_ == 14) {
        $("#eduform_").prop("disabled", 'disabled');
        $("#direction_").prop("disabled", 'disabled');
        $("#prof_").prop("disabled", 'disabled');
        $("#originals_").prop("disabled", 'disabled');
        $("#paid_").prop("disabled", 'disabled');
        $('#ratingForm > button').prop("disabled", false);
    } else {
        $("#org_").prop("disabled", false);
        $("#eduform_").prop("disabled", false);
        $("#direction_").prop("disabled", false);
        $("#prof_").prop("disabled", false);
    }

}
