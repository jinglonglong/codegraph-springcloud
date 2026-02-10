program App;

{$APPTYPE CONSOLE}

uses
  System.SysUtils,
  UAuth in 'UAuth.pas';

var
  Svc: TAuthService;

begin
  Svc := TAuthService.Create;
  try
    Writeln(Svc.Login('olaf', 'secret'));
  finally
    Svc.Free;
  end;
end.
