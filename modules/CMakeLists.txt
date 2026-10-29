# Every exercise is an independent static library.
set(CSDKTD_MODULE_IDS
    cr01
    cr02
    cr03
    cr04
    cr05
    cr06
    cp01
    cp02
    cp03
    cp04
    cp05
    cp06
    cs01
    cs02
    cs03
    cs04
    cs05
    cf01
    cf02
    cf03
    cf04
    cf05
    cd01
    cd02
    cd03
    cd04
    cd05
    cd06
    cd07
    cd08
    cd09
    dr01
    dr02
    dr03
    dr04
    dr05
    dp01
    dp02
    dp03
    dp04
    ds01
    ds02
    ds03
    ds04
    ds05
    df01
    df02
    df03
    df04
    dd01
    dd02
    dd03
    dd04
    dd05
    dd06
    dd07
)

add_library(csd_modules INTERFACE)

foreach(module_id IN LISTS CSDKTD_MODULE_IDS)
    add_library(csd_module_${module_id} STATIC ${module_id}/module.c)
    target_link_libraries(csd_module_${module_id} PUBLIC csd_module_api)
    set_target_properties(csd_module_${module_id} PROPERTIES
        FOLDER "CSDKTD/Modules"
        C_STANDARD 11
        C_STANDARD_REQUIRED YES
        C_EXTENSIONS NO
    )
    target_link_libraries(csd_modules INTERFACE csd_module_${module_id})
endforeach()
