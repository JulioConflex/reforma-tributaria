@echo off
echo Liberando portas no Firewall...
netsh advfirewall firewall delete rule name="RT-3000" >nul 2>&1
netsh advfirewall firewall delete rule name="RT-8000" >nul 2>&1
netsh advfirewall firewall add rule name="RT-3000" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="RT-8000" dir=in action=allow protocol=TCP localport=8000
echo.
echo Portas 3000 e 8000 liberadas!
pause
